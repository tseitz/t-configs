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
#
# CREATING the worktree (worktrees need explicit approval first — see
# rules/common/development-workflow.md):
#
#   Location is always <repo-root>/.claude/worktrees/<branch-name>. Do not improvise
#   one from `git worktree list`, from external tooling paths, or from the skill's
#   ~/.config/superpowers fallback. Before creating, make sure .claude/worktrees/ is
#   gitignored and commit that — .claude/ itself is usually tracked, the subdirectory
#   must not be.
#
# AFTER bootstrapping, to run an rspack dev server from the worktree, prefix it with
# CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true, or chokidar crashes with EMFILE.
#
set -euo pipefail
shopt -s nullglob

skip_install=false
[ "${1:-}" = "--skip-install" ] && skip_install=true

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
for src in .env .env.* .envrc mise.local.toml *.local.toml; do
  [ -f "$src" ] || continue
  git check-ignore -q "$src" || continue
  [ -e "$here/$src" ] && continue
  cp "$src" "$here/$src"
  copied+=("$src")
done
cd "$here"

if [ ${#copied[@]} -gt 0 ]; then
  echo "✓ Copied gitignored env files: ${copied[*]}"
else
  echo "• No gitignored env files to copy (already present or none)."
fi
echo

# ── 2. Install dependencies ──────────────────────────────────────────────────
if [ "$skip_install" = true ]; then
  echo "• Skipping dependency install (--skip-install)."
  exit 0
fi

# Route through mise when the repo pins tools with it, so the right node/pnpm
# is used (Homebrew pnpm / system ruby fail in these repos). CI=true keeps pnpm
# non-interactive (it otherwise prompts before resetting an inconsistent store).
run() {
  if [ -f mise.toml ] || [ -f mise.local.toml ]; then
    CI=true mise exec -- "$@"
  else
    CI=true "$@"
  fi
}

if [ -f pnpm-lock.yaml ]; then
  echo "Installing dependencies with pnpm…"
  run pnpm install --frozen-lockfile
elif [ -f yarn.lock ]; then
  echo "Installing dependencies with yarn…"
  run yarn install --frozen-lockfile
elif [ -f package-lock.json ]; then
  echo "Installing dependencies with npm…"
  run npm ci
elif [ -f package.json ]; then
  echo "Installing dependencies with npm (no lockfile)…"
  run npm install
else
  echo "• No package.json — skipping dependency install."
fi

echo
echo "✓ Worktree bootstrap complete: $here"
