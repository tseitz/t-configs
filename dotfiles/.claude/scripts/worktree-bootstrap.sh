#!/usr/bin/env bash
#
# worktree-bootstrap.sh — prepare a freshly-created git worktree for local dev.
#
# Git worktrees only carry TRACKED files, so gitignored local config (env vars,
# secrets) never comes across, and node_modules is empty. This script fixes both:
#   1. Copies gitignored env/config files from the MAIN worktree into this one.
#   2. Installs dependencies with the repo's package manager (via mise if present).
#
# Idempotent: only copies files that are missing here, safe to re-run. It replaces
# the generic `npm install` step in superpowers:using-git-worktrees.
#
# Usage:
#   ~/.claude/scripts/worktree-bootstrap.sh                 # from inside a new worktree
#   ~/.claude/scripts/worktree-bootstrap.sh --skip-install  # copy env files only
#   ~/.claude/scripts/worktree-bootstrap.sh --untrusted     # someone else's unread code: no install-time code runs
#   ~/.claude/scripts/worktree-bootstrap.sh --log <file>    # all output to <file>
#
# --untrusted is review-prs.js's whole safety envelope: loosen it and PR code runs at install.
#
# CREATING the worktree (worktrees need explicit approval first — see
# rules/common/development-workflow.md):
#
#   Location is always ~/code/worktrees/<repo-name>/<branch-name> — central, not inside
#   the repo. Do not improvise one from `git worktree list`, from external tooling
#   paths, or from the skill's ~/.config/superpowers fallback.
#
#   Inside Herdr, `herdr worktree create --branch <name>` produces exactly that path
#   and opens it as its own workspace.
#
# AFTER bootstrapping, to run an rspack dev server from the worktree, prefix it with
# CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true, or chokidar crashes with EMFILE.
#
set -euo pipefail
shopt -s nullglob

skip_install=false
untrusted=false
log=""
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-install) skip_install=true ;;
    --untrusted) untrusted=true ;;
    --log) log="${2:?--log needs a path}"; shift ;;
    *) echo "✗ Unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

[ -n "$log" ] && exec >"$log" 2>&1

# The worktree we're in, and the main worktree (first entry of `worktree list`,
# which is the canonical source of the gitignored files we need to copy).
here="$(git rev-parse --show-toplevel)"
main="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

if [ "$here" = "$main" ]; then
  echo "✗ This is the main worktree ($main)." >&2
  echo "  Run this from inside a newly-created worktree." >&2
  exit 1
fi

echo "Main worktree: $main"
echo "This worktree: $here"
echo

# ── 1. Copy gitignored env/config files ─────────────────────────────────────
# Only root-level env-shaped files, only if gitignored in main (so we never
# shadow a tracked file), only if absent here (never clobber).
copied=()
cd "$main"
for src in .env .env.* .envrc mise.local.toml .mise.local.toml *.local.toml; do
  [ -f "$src" ] || continue
  git check-ignore -q "$src" || continue
  # -L too: cp writes through a dangling symlink the PR committed.
  { [ -e "$here/$src" ] || [ -L "$here/$src" ]; } && continue
  cp "$src" "$here/$src"
  copied+=("$src")
done
cd "$here"

if [ ${#copied[@]} -gt 0 ]; then
  echo "✓ Copied gitignored env files: ${copied[*]}"
else
  echo "• No gitignored env files to copy (already present or none)."
fi

# Paranoid mise leaves a copied config untrusted, and every shell here then errors on it.
if [ ${#copied[@]} -gt 0 ] && command -v mise >/dev/null; then
  for f in "${copied[@]}"; do
    case "$f" in
      mise.local.toml | .mise.local.toml | mise.*.local.toml | .mise.*.local.toml)
        mise trust --quiet "$here/$f"
        echo "✓ Trusted $f" ;;
    esac
  done
fi
echo

# ── 1b. Gems kept inside the main clone (BUNDLE_PATH: vendor/bundle) ────────
# Cloned copy-on-write, not pointed at: near-free on APFS, no bundle install (which would run
# the Gemfile), and nothing done here can reach the main clone's gems.
if [ -f "$main/.bundle/config" ] && git -C "$main" check-ignore -q .bundle/config \
  && ! { [ -e "$here/.bundle" ] || [ -L "$here/.bundle" ]; }; then
  mkdir -p "$here/.bundle"
  cp "$main/.bundle/config" "$here/.bundle/config"
  echo "✓ Copied .bundle/config"
fi
if grep -qE '^BUNDLE_PATH: "?vendor/bundle"?$' "$here/.bundle/config" 2>/dev/null && [ -d "$main/vendor/bundle" ] \
  && ! { [ -e "$here/vendor/bundle" ] || [ -L "$here/vendor/bundle" ] || [ -L "$here/vendor" ]; }; then
  mkdir -p "$here/vendor"
  if cp -cR "$main/vendor/bundle" "$here/vendor/bundle" 2>/dev/null; then
    echo "✓ Cloned vendor/bundle from the main worktree"
  else
    rm -rf "$here/vendor/bundle"
    echo "• Couldn't clone vendor/bundle (cp -c needs APFS) — run bundle install yourself."
  fi
fi
echo

# ── 2. Install dependencies ──────────────────────────────────────────────────
if [ "$skip_install" = true ]; then
  echo "• Skipping dependency install (--skip-install)."
  exit 0
fi

if [ "$untrusted" = true ]; then
  # pnpm and yarn read config from every parent dir, and sandboxed code can write
  # ~/Code/worktrees. $HOME's own files are mine and read as user config anyway.
  dir="$(dirname "$here")"
  while [ "$dir" != "$HOME" ] && [ "$dir" != / ]; do
    for f in package.json pnpm-workspace.yaml .npmrc .yarnrc .yarnrc.yml .pnpmfile.cjs .pnpmfile.mjs .corepack.env node_modules; do
      if [ -e "$dir/$f" ] || [ -L "$dir/$f" ]; then
        echo "✗ $dir/$f would configure this install — not installing." >&2
        exit 1
      fi
    done
    dir="$(dirname "$dir")"
  done

  # Else the PR picks what runs: .corepack.env can point yarn at any URL, mise auto-installs
  # from the PR's mise.lock, pnpm 10 switches itself to the version packageManager names.
  # The rest back up the per-manager flags below.
  export COREPACK_ENV_FILE=0 MISE_EXEC_AUTO_INSTALL=0 MISE_NOT_FOUND_AUTO_INSTALL=0 \
    npm_config_manage_package_manager_versions=false YARN_IGNORE_PATH=1 \
    YARN_ENABLE_SCRIPTS=false npm_config_ignore_scripts=true
fi

# Route through mise when the repo pins tools with it, so the right node/pnpm
# is used (Homebrew pnpm / system ruby fail in these repos). CI=true keeps pnpm
# non-interactive (it otherwise prompts before resetting an inconsistent store).
# exec, so a caller's timeout signal reaches the package manager, not just this shell.
run() {
  if [ -f mise.toml ] || [ -f .mise.toml ] || [ -f mise.local.toml ] || [ -f .mise.local.toml ]; then
    CI=true exec mise exec -- "$@"
  else
    CI=true exec "$@"
  fi
}

# From packageManager, not `yarn --version`: running yarn is what corepack hijacks.
yarn_is_classic() {
  local major
  major="$(grep -oE '"packageManager"[[:space:]]*:[[:space:]]*"yarn@[0-9]+' package.json | grep -oE '[0-9]+$' || true)"
  if [ -n "$major" ]; then [ "$major" = 1 ]; else [ ! -f .yarnrc.yml ]; fi
}

if [ -f pnpm-lock.yaml ]; then
  echo "Installing dependencies with pnpm…"
  flags=(--frozen-lockfile)
  # --ignore-scripts doesn't cover the pnpmfile, and package.json can pull one in.
  [ "$untrusted" = true ] && flags+=(--ignore-scripts --ignore-pnpmfile)
  run pnpm install "${flags[@]}"
elif [ -f yarn.lock ]; then
  echo "Installing dependencies with yarn…"
  if yarn_is_classic; then
    flags=(--frozen-lockfile)
    [ "$untrusted" = true ] && flags+=(--ignore-scripts)
  else
    flags=(--immutable)
    [ "$untrusted" = true ] && flags+=(--mode=skip-build)
  fi
  run yarn install "${flags[@]}"
elif [ -f package.json ] && [ "$untrusted" = true ]; then
  echo "✗ --untrusted supports pnpm and yarn only — not installing." >&2
  exit 1
elif [ -f package-lock.json ]; then
  echo "Installing dependencies with npm…"
  run npm ci
elif [ -f package.json ]; then
  echo "Installing dependencies with npm (no lockfile)…"
  run npm install
else
  echo "• No package.json — skipping dependency install."
  echo
  echo "✓ Worktree bootstrap complete: $here"
fi
