#!/usr/bin/env bash
set -euo pipefail

# ============================================
# t-configs bootstrap script
# ============================================
# Idempotent — safe to run multiple times.
#
# Usage: ./install.sh           # interactive (prompts per step)
#        ./install.sh --yes     # non-interactive (run everything)
#        ./install.sh --sync    # non-interactive, ADD-ONLY (see below)
#        ./install.sh --check   # report drift, change nothing
#        ./install.sh --dry-run # list the steps, change nothing
#        ./install.sh --verbose # also print already-correct symlinks
#
# --sync is the "get this machine back in line with my other one" mode. It runs
# every step non-interactively, but refuses the one destructive branch: if a real
# file or a link to somewhere else already occupies a symlink destination, it
# reports the drift and moves on instead of backing the file up and replacing it.
# So it only ever ADDS what's missing. Use a full ./install.sh to take over a
# destination that already has local content.
# ============================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOTFILES_DIR="$REPO_DIR/dotfiles"

# ------------------------------------------
# Platform detection
# ------------------------------------------
# Three platforms now, not two. macOS and WSL both use Homebrew; Arch does not —
# every Brewfile.wsl package is in the official repos, so installing linuxbrew
# there would put a second git/neovim/deno ahead of /usr/bin on PATH. IS_OMARCHY
# is narrower than IS_ARCH: it gates the places where Omarchy ships its own
# config (neovim, ~/.claude/skills) that this repo must not clobber.
IS_MACOS=false; IS_ARCH=false; IS_OMARCHY=false
if [[ "$OSTYPE" == darwin* ]]; then
  IS_MACOS=true
elif [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == arch || "${ID_LIKE:-}" == *arch* ]] && IS_ARCH=true
  [[ "${ID:-}" == omarchy ]] && IS_OMARCHY=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[info]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $1"; }
error()   { echo -e "${RED}[err]${NC}  $1"; }

# ------------------------------------------
# Flags
# ------------------------------------------
YES_ALL=false
DRY_RUN=false
SYNC_ONLY=false
CHECK_ONLY=false
SYNC_LISTS=false
VERBOSE=false
for arg in "$@"; do
  [[ "$arg" == "--yes"     || "$arg" == "-y" ]] && YES_ALL=true
  [[ "$arg" == "--dry-run" || "$arg" == "-n" ]] && DRY_RUN=true
  [[ "$arg" == "--verbose" || "$arg" == "-v" ]] && VERBOSE=true
  [[ "$arg" == "--sync"    || "$arg" == "-s" ]] && { SYNC_ONLY=true; YES_ALL=true; }
  [[ "$arg" == "--check"   || "$arg" == "-c" ]] && CHECK_ONLY=true
  [[ "$arg" == "--sync-lists"                ]] && SYNC_LISTS=true
done

# --sync-lists: append base entries this machine is missing from the additive
# allow-lists in settings.json. Runs alone and exits — it must not drag the
# whole installer along, and it is the only path allowed to edit a
# machine-owned settings.json.
if ${SYNC_LISTS:-false}; then
  node "$DOTFILES_DIR/.claude/scripts/settings-drift.js" --apply
  exit $?
fi

# ------------------------------------------
# Brew PATH — run unconditionally so step 2
# works even when step 1 is skipped
# ------------------------------------------
brew_shellenv() {
  $IS_ARCH && return 0   # Arch uses pacman; there is no brew to put on PATH
  if [[ "$OSTYPE" == linux* ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null)" || true
  else
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
  fi
}
brew_shellenv

# ------------------------------------------
# Step runner — prompts unless --yes/--dry-run
# ------------------------------------------
FAILED_STEPS=()

run_step() {
  local label="$1"
  local fn="$2"

  if $DRY_RUN; then
    echo -e "${CYAN}▶ [dry-run] $label${NC}"
    return
  fi

  if $YES_ALL; then
    echo -e "\n${CYAN}▶ $label${NC}"
  else
    echo ""
    printf "${CYAN}▶ $label${NC} — run this step? [y/N] "
    read -r answer </dev/tty
    case "$answer" in
      [yY]*) ;;
      *) info "Skipping: $label"; return ;;
    esac
  fi

  # The subshell must NOT be the condition of an `if`. Bash suspends `set -e` for
  # the whole command being tested — including inside the subshell, even though it
  # re-arms the flag itself — so `if ! ( set -euo pipefail; $fn )` let every step
  # run past its own failures and then report success from its final statement.
  # Running it standalone (with -e off in the parent so the script survives) is
  # what actually makes the inner `set -e` bite.
  local status=0
  set +e
  ( set -euo pipefail; $fn )
  status=$?
  set -e

  if (( status != 0 )); then
    error "Step failed: $label"
    FAILED_STEPS+=("$label")
  fi
}

# ------------------------------------------
# 1. Install Homebrew
# ------------------------------------------
step_homebrew() {
  if $IS_ARCH; then
    success "Arch — packages come from pacman, skipping Homebrew"
  elif command -v brew &>/dev/null; then
    success "Homebrew already installed"
  else
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    success "Homebrew installed"
    brew_shellenv   # so brew is in PATH immediately after a fresh install
  fi
}

# ------------------------------------------
# 2. Install Homebrew packages
# ------------------------------------------
# One package line per non-blank, non-comment line of the Pacfile.
pacfile_packages() { sed -e 's/#.*//' -e 's/[[:space:]]//g' "$REPO_DIR/Pacfile" | grep -v '^$'; }

step_packages() {
  if $IS_ARCH; then
    [ -f "$REPO_DIR/Pacfile" ] || { warn "No Pacfile found, skipping"; return 0; }
    # Resolve what is actually missing first. `pacman -S --needed` is already
    # idempotent, but it still needs root — so asking it to install a fully
    # satisfied list makes a no-op re-run prompt for a password for nothing.
    local missing=() pkg
    while IFS= read -r pkg; do
      pacman -T "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done < <(pacfile_packages)
    if (( ${#missing[@]} == 0 )); then
      success "Pacfile already satisfied — nothing to install"
      return 0
    fi
    info "Installing ${#missing[@]} missing package(s) via pacman: ${missing[*]}"
    sudo pacman -S --needed "${missing[@]}"
    success "pacman packages installed"
    return 0
  fi
  if [[ "$OSTYPE" == linux* ]] && [ -f "$REPO_DIR/Brewfile.wsl" ]; then
    BREWFILE="$REPO_DIR/Brewfile.wsl"
  else
    BREWFILE="$REPO_DIR/Brewfile"
  fi
  if [ -f "$BREWFILE" ]; then
    info "Installing Homebrew packages from $(basename "$BREWFILE")..."
    brew bundle --file="$BREWFILE"
    success "Homebrew packages installed"
  else
    warn "No Brewfile found, skipping"
  fi
}

# ------------------------------------------
# 3. Install oh-my-zsh
# ------------------------------------------
step_ohmyzsh() {
  # Test for the loader, not the directory. Steps 4 and 5 clone into
  # $ZSH_CUSTOM (~/.oh-my-zsh/custom) and create ~/.oh-my-zsh as a side effect,
  # so a directory test reports "already installed" for an empty husk that has
  # no oh-my-zsh.sh in it — and .zshrc then fails to source on every start.
  if [ -f "$HOME/.oh-my-zsh/oh-my-zsh.sh" ]; then
    success "oh-my-zsh already installed"
    return 0
  fi
  # The upstream installer refuses to run without zsh on PATH, which is exactly
  # the case on a fresh box before the package step has run.
  if ! command -v zsh &>/dev/null; then
    error "zsh is not installed — run the package step first, then re-run"
    return 1
  fi
  # The upstream installer aborts outright when $ZSH already exists, so a husk
  # left by steps 4/5 blocks the install forever. Clear it — but carry custom/
  # across, since that is where those steps put the plugins and the theme.
  local stash=""
  if [ -d "$HOME/.oh-my-zsh" ]; then
    warn "~/.oh-my-zsh exists but has no oh-my-zsh.sh — reinstalling over the husk"
    if [ -d "$HOME/.oh-my-zsh/custom" ]; then
      stash="$(mktemp -d "${TMPDIR:-/tmp}/omz-custom.XXXXXX")"
      mv "$HOME/.oh-my-zsh/custom" "$stash/custom"
    fi
    rm -rf "$HOME/.oh-my-zsh"
  fi
  info "Installing oh-my-zsh..."
  # KEEP_ZSHRC: the installer otherwise moves our symlinked .zshrc aside and
  # drops its own template in place, undoing step 7.
  KEEP_ZSHRC=yes RUNZSH=no CHSH=no \
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
  if [ -n "$stash" ]; then
    rm -rf "$HOME/.oh-my-zsh/custom"
    mv "$stash/custom" "$HOME/.oh-my-zsh/custom"
    rmdir "$stash"
    info "restored ~/.oh-my-zsh/custom (plugins and theme)"
  fi
  success "oh-my-zsh installed"
}

# ------------------------------------------
# 4. Install oh-my-zsh custom plugins
# ------------------------------------------
step_omz_plugins() {
  ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

  install_omz_plugin() {
    local name="$1"
    local url="$2"
    local plugin_dir="$ZSH_CUSTOM/plugins/$name"
    if [ -d "$plugin_dir" ]; then
      success "Plugin '$name' already installed"
    else
      info "Installing oh-my-zsh plugin: $name..."
      git clone "$url" "$plugin_dir"
      success "Plugin '$name' installed"
    fi
  }

  install_omz_plugin "zsh-syntax-highlighting" "https://github.com/zsh-users/zsh-syntax-highlighting.git"
  install_omz_plugin "zsh-autosuggestions" "https://github.com/zsh-users/zsh-autosuggestions.git"
}

# ------------------------------------------
# 5. Install spaceship prompt theme
# ------------------------------------------
step_spaceship() {
  ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
  SPACESHIP_DIR="$ZSH_CUSTOM/themes/spaceship-prompt"
  if [ -d "$SPACESHIP_DIR" ]; then
    success "Spaceship theme already installed"
  else
    info "Installing spaceship prompt theme..."
    git clone https://github.com/spaceship-prompt/spaceship-prompt.git "$SPACESHIP_DIR" --depth=1
    ln -sf "$SPACESHIP_DIR/spaceship.zsh-theme" "$ZSH_CUSTOM/themes/spaceship.zsh-theme"
    success "Spaceship theme installed"
  fi
}

# ------------------------------------------
# 6. Install mise runtimes
# ------------------------------------------
step_mise() {
  if command -v mise &>/dev/null; then
    info "Installing default runtimes via mise (Node from mise.toml)..."
    (cd "$REPO_DIR" && mise install)
    mise use -g node@latest
    success "mise runtimes installed (Node available by default)"
  else
    warn "mise not found, skipping runtime install (run install.sh again after opening a new terminal)"
  fi
}

# ------------------------------------------
# 7. Create symlinks
# ------------------------------------------
LINKS_OK=0; LINKS_ADDED=0; LINKS_DRIFT=0; LINKS_ABSENT=0

# --check must not touch the disk, and creating an empty parent dir counts.
ensure_dir() { $CHECK_ONLY || mkdir -p "$@"; }

link_summary() {
  local msg="links: ${LINKS_OK} ok, ${LINKS_ADDED} created, ${LINKS_DRIFT} drifted, ${LINKS_ABSENT} skipped (not in repo)"
  if (( LINKS_DRIFT > 0 )); then warn "$msg"; else success "$msg"; fi
  $VERBOSE || (( LINKS_OK == 0 )) || info "re-run with --verbose to list the ${LINKS_OK} already-correct links"
}

# Pick a .bak name that isn't taken. The old code always used "$dest.bak", so a
# second run would silently destroy the backup the first run had just made.
backup_path() {
  local dest="$1" n=1 candidate="${1}.bak"
  while [ -e "$candidate" ]; do candidate="${dest}.bak.${n}"; n=$((n + 1)); done
  printf '%s' "$candidate"
}

create_symlink() {
  local src="$1"
  local dest="$2"

  # Never link to a path that isn't in the repo. Without this guard the script
  # happily creates dangling links (this is how ~/.claude/AGENTS.md, plugin.json,
  # hooks/ et al. came to point at nothing). Skipping rather than deleting the
  # call site means re-adding the file to the repo revives the link with no edit.
  if [ ! -e "$src" ]; then
    warn "not in repo, skipped: ${src#"$DOTFILES_DIR"/}"
    LINKS_ABSENT=$((LINKS_ABSENT + 1))
    return
  fi

  local link_target=""
  [ -L "$dest" ] && link_target="$(readlink "$dest")"

  # Already correct — the overwhelmingly common case on a set-up machine.
  if [ "$link_target" = "$src" ]; then
    LINKS_OK=$((LINKS_OK + 1))
    $VERBOSE && success "ok: $dest"
    return 0
  fi

  # Nothing there, or a dangling link. Safe in every mode — there is no content
  # to lose, so even --sync and --check-less runs can create it outright.
  if [ ! -e "$dest" ]; then
    LINKS_DRIFT=$((LINKS_DRIFT + 1))
    if $CHECK_ONLY; then
      warn "missing: $dest -> $src"
      return 0
    fi
    [ -n "$link_target" ] && rm "$dest"   # dangling link
    ln -s "$src" "$dest"
    success "linked: $dest -> $src"
    LINKS_ADDED=$((LINKS_ADDED + 1))
    LINKS_DRIFT=$((LINKS_DRIFT - 1))
    return 0
  fi

  # Something real occupies the destination: a live file/dir, or a link pointing
  # elsewhere. This is the only branch that can destroy local state, so --check
  # and --sync report it and stop. Only a full install takes the destination over.
  LINKS_DRIFT=$((LINKS_DRIFT + 1))
  if $CHECK_ONLY || $SYNC_ONLY; then
    if [ -n "$link_target" ]; then
      warn "drift: $dest -> $link_target (repo wants $src)"
    else
      warn "drift: $dest is a real file/dir, not a link to $src"
    fi
    warn "       left alone — run ./install.sh to replace it (backs up first)"
    return 0
  fi

  if [ -n "$link_target" ]; then
    # A link has no content of its own, so there is nothing to back up.
    warn "repointing: $dest -> $link_target  =>  $src"
    ln -sfn "$src" "$dest"   # -n so a link to a DIR is replaced, not written into
  elif diff -rq "$src" "$dest" >/dev/null 2>&1; then
    # Byte-identical to the repo copy — a .bak here is pure noise.
    info "identical to repo, replacing without backup: $dest"
    rm -rf "$dest"
    ln -s "$src" "$dest"
  else
    local bak; bak="$(backup_path "$dest")"
    warn "existing $dest differs from repo — backing up to $bak"
    mv "$dest" "$bak"
    ln -s "$src" "$dest"
  fi
  success "linked: $dest -> $src"
  LINKS_ADDED=$((LINKS_ADDED + 1))
  LINKS_DRIFT=$((LINKS_DRIFT - 1))
}

# Link each entry of a repo directory into an existing destination directory,
# instead of replacing the directory itself. Needed where something else owns
# the destination and has put its own entries there: Omarchy symlinks its
# diagnose-crash and omarchy skills into ~/.claude/skills, and a whole-directory
# link would take both out. Costs one thing — a skill added to the repo only
# appears after the next install run, rather than the instant it is committed.
link_dir_contents() {
  local src_dir="$1" dest_dir="$2" entry

  # Convert a legacy whole-directory link left by an earlier run.
  if [ -L "$dest_dir" ]; then
    if $CHECK_ONLY; then
      warn "drift: $dest_dir is a directory symlink (want per-entry links)"
    else
      warn "replacing directory symlink $dest_dir with per-entry links"
      rm "$dest_dir"
    fi
  fi
  ensure_dir "$dest_dir"
  $CHECK_ONLY && [ ! -d "$dest_dir" ] && return 0

  for entry in "$src_dir"/*; do
    [ -e "$entry" ] || continue     # unmatched glob when the repo dir is empty
    create_symlink "$entry" "$dest_dir/$(basename "$entry")"
  done
}

step_symlinks() {
  if $CHECK_ONLY; then
    info "Auditing symlinks (no changes)..."
  elif $SYNC_ONLY; then
    info "Syncing symlinks (add-only)..."
  else
    info "Creating symlinks..."
  fi
  create_symlink "$DOTFILES_DIR/.zshrc"      "$HOME/.zshrc"
  create_symlink "$DOTFILES_DIR/.zshenv"     "$HOME/.zshenv"
  create_symlink "$DOTFILES_DIR/.gitconfig"  "$HOME/.gitconfig"
  create_symlink "$DOTFILES_DIR/.zprofile"   "$HOME/.zprofile"
  # .hushlogin only suppresses the macOS login banner — inert clutter elsewhere.
  $IS_MACOS && create_symlink "$DOTFILES_DIR/.hushlogin" "$HOME/.hushlogin"

  # .gitconfig-work: work commit identity, pulled in by .gitconfig's includeIf for
  # repos under ~/Code/presentation/. Gitignored because this repo is public — and a
  # missing include is silently ignored by git, so an unseeded machine would quietly
  # sign work commits with the personal email. Seed it here and warn until it's real.
  if [ ! -f "$DOTFILES_DIR/.gitconfig-work" ]; then
    $CHECK_ONLY || cp "$DOTFILES_DIR/.gitconfig-work.example" "$DOTFILES_DIR/.gitconfig-work"
    warn "Created .gitconfig-work from example — set your work email in it"
  elif grep -q "you@example.com" "$DOTFILES_DIR/.gitconfig-work"; then
    warn ".gitconfig-work still has the placeholder email — work commits will be wrong"
  else
    success ".gitconfig-work already set (work identity preserved)"
  fi

  # Neovim config. Omarchy ships its own LazyVim wired into the system theme
  # (omarchy-theme-hotreload, transparency, all-themes). This repo's copy is
  # near-stock LazyVim, so taking the destination over there would trade real
  # desktop integration for nothing.
  ensure_dir "$HOME/.config"
  if $IS_OMARCHY; then
    info "Omarchy provides its own neovim config — leaving ~/.config/nvim alone"
  else
    create_symlink "$DOTFILES_DIR/.config/nvim" "$HOME/.config/nvim"
  fi

  # VS Code User settings. The file lives under .config/editors/ rather than
  # .config/Code/ so a second editor can share it without moving the source.
  if $IS_MACOS; then
    VSCODE_USER_DIR="$HOME/Library/Application Support/Code/User"
  else
    VSCODE_USER_DIR="$HOME/.config/Code/User"
  fi
  # Only seed the settings link when VS Code is actually on the machine —
  # otherwise this conjures an empty ~/.config/Code/User on every box.
  if command -v code &>/dev/null || [ -d "$VSCODE_USER_DIR" ]; then
    ensure_dir "$VSCODE_USER_DIR"
    create_symlink "$DOTFILES_DIR/.config/editors/settings.json" "$VSCODE_USER_DIR/settings.json"
  else
    info "VS Code not installed — skipping editor settings link"
  fi

  # ── Claude Code (.claude is the first-class citizen) ──────────────────
  ensure_dir "$HOME/.claude"

  # Directories (symlink entire dirs)
  if $IS_OMARCHY; then
    link_dir_contents "$DOTFILES_DIR/.claude/skills" "$HOME/.claude/skills"
  else
    create_symlink "$DOTFILES_DIR/.claude/skills" "$HOME/.claude/skills"
  fi
  create_symlink "$DOTFILES_DIR/.claude/rules"    "$HOME/.claude/rules"
  create_symlink "$DOTFILES_DIR/.claude/agents"   "$HOME/.claude/agents"
  create_symlink "$DOTFILES_DIR/.claude/commands" "$HOME/.claude/commands"
  create_symlink "$DOTFILES_DIR/.claude/hooks"    "$HOME/.claude/hooks"
  create_symlink "$DOTFILES_DIR/.claude/scripts"  "$HOME/.claude/scripts"
  create_symlink "$DOTFILES_DIR/.claude/output-styles" "$HOME/.claude/output-styles"

  # settings.json is SEEDED from settings.base.json once, then OWNED by this
  # machine — it is never symlinked and never synced back to the repo. The base
  # is a hand-curated, sanitized template; each machine extends it freely
  # (Claude Code's atomic writes, /config edits, plugin toggles, effort level).
  # Account-specific overrides go in settings.local.json (see below). To evolve
  # the shared baseline, edit settings.base.json deliberately.
  if [ -f "$HOME/.claude/settings.json" ] && [ ! -L "$HOME/.claude/settings.json" ]; then
    info "settings.json already exists (machine-owned, left untouched)"
  elif $CHECK_ONLY; then
    warn "missing: $HOME/.claude/settings.json (would seed from settings.base.json)"
  else
    [ -L "$HOME/.claude/settings.json" ] && warn "Replacing settings.json symlink with a copy (symlinks break Claude Code atomic writes)" && rm "$HOME/.claude/settings.json"
    cp "$DOTFILES_DIR/.claude/settings.base.json" "$HOME/.claude/settings.json"
    success "settings.json seeded from settings.base.json (now machine-owned)"
  fi
  # CLAUDE.md IS symlinked (unlike settings.json). Claude Code edits it in place,
  # so a symlink is safe — and it means "update my global instructions" edits land
  # in the repo automatically. Machine-specific config belongs in settings.local.json.
  create_symlink "$DOTFILES_DIR/.claude/CLAUDE.md"              "$HOME/.claude/CLAUDE.md"
  create_symlink "$DOTFILES_DIR/.claude/AGENTS.md"              "$HOME/.claude/AGENTS.md"
  create_symlink "$DOTFILES_DIR/.claude/README.md"              "$HOME/.claude/README.md"
  create_symlink "$DOTFILES_DIR/.claude/plugin.json"            "$HOME/.claude/plugin.json"
  create_symlink "$DOTFILES_DIR/.claude/marketplace.json"       "$HOME/.claude/marketplace.json"
  create_symlink "$DOTFILES_DIR/.claude/statusline-command.sh"  "$HOME/.claude/statusline-command.sh"
  create_symlink "$DOTFILES_DIR/.claude/the-security-guide.md"  "$HOME/.claude/the-security-guide.md"
  create_symlink "$DOTFILES_DIR/.claude/PLUGIN_SCHEMA_NOTES.md" "$HOME/.claude/PLUGIN_SCHEMA_NOTES.md"

  # Plugins: the repo manifest is the WANTED list; step 9 installs from it.
  # installed_plugins.json is deliberately NOT symlinked. Claude Code rewrites it
  # in place as a real file (same reason settings.json isn't linked), so linking it
  # produced a churn loop: every install backed up the file and re-linked, Claude
  # replaced the link with a file again, and the next run made another .bak.
  ensure_dir "$HOME/.claude/plugins"
  # The manifest is gitignored (see .gitignore), so a fresh clone never has it.
  # Both branches below cp from the repo copy unconditionally, which aborted the
  # whole step under `set -e` on exactly the machine this script exists to set up.
  if [ ! -f "$DOTFILES_DIR/.claude/plugins/installed_plugins.json" ]; then
    warn "no plugin manifest in the repo (it is gitignored) — nothing to seed"
  elif [ -L "$HOME/.claude/plugins/installed_plugins.json" ]; then
    warn "installed_plugins.json is a symlink (legacy) — replacing with a real copy"
    $CHECK_ONLY || { rm "$HOME/.claude/plugins/installed_plugins.json"; \
      cp "$DOTFILES_DIR/.claude/plugins/installed_plugins.json" "$HOME/.claude/plugins/installed_plugins.json"; }
  elif [ ! -f "$HOME/.claude/plugins/installed_plugins.json" ]; then
    $CHECK_ONLY || cp "$DOTFILES_DIR/.claude/plugins/installed_plugins.json" "$HOME/.claude/plugins/installed_plugins.json"
    success "installed_plugins.json seeded from repo manifest"
  fi

  # settings.local.json: create from example if it doesn't exist (account-specific overrides)
  if [ ! -f "$HOME/.claude/settings.local.json" ]; then
    if [ -f "$DOTFILES_DIR/.claude/settings.local.json.example" ]; then
      $CHECK_ONLY || cp "$DOTFILES_DIR/.claude/settings.local.json.example" "$HOME/.claude/settings.local.json"
      success "Created settings.local.json from example (edit for your account preferences)"
    fi
  else
    success "settings.local.json already exists (account-specific overrides preserved)"
  fi

  # Printed here, not at the end of the script: run_step executes each step in a
  # subshell, so the counters never make it back to the parent.
  link_summary
}

# ------------------------------------------
# Read-only drift checks (--check only)
# ------------------------------------------
step_check_packages() {
  if $IS_ARCH; then
    [ -f "$REPO_DIR/Pacfile" ] || { warn "no Pacfile found"; return 0; }
    info "Checking Pacfile against installed packages..."
    local missing=() pkg
    while IFS= read -r pkg; do
      # -T prints the arg back when nothing PROVIDES it, so virtual packages and
      # renamed providers (e.g. mise-bin for mise) count as satisfied.
      pacman -T "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done < <(pacfile_packages)
    if (( ${#missing[@]} == 0 )); then
      success "Pacfile satisfied — nothing missing"
    else
      warn "packages missing (install with: sudo pacman -S --needed ${missing[*]}):"
      for pkg in "${missing[@]}"; do warn "  $pkg"; done
    fi
    return 0
  fi
  if ! command -v brew &>/dev/null; then warn "brew not installed on this machine"; return 0; fi
  local brewfile="$REPO_DIR/Brewfile"
  if [[ "$OSTYPE" == linux* ]] && [ -f "$REPO_DIR/Brewfile.wsl" ]; then brewfile="$REPO_DIR/Brewfile.wsl"; fi
  [ -f "$brewfile" ] || { warn "no Brewfile found"; return 0; }
  info "Checking $(basename "$brewfile")..."
  if brew bundle check --file="$brewfile" >/dev/null 2>&1; then
    success "Brewfile satisfied — nothing missing"
  else
    warn "Homebrew packages missing (install with: brew bundle --file=$brewfile):"
    brew bundle check --file="$brewfile" --verbose 2>&1 | grep -v '^Homebrew bundle' || true
  fi
}

# The repo manifest is the wanted list; ~/.claude is what Claude Code actually has.
# Drift goes both ways: plugins added on the other machine, and plugins installed
# here that were never written back to the repo.
step_check_claude_plugins() {
  local repo_manifest="$DOTFILES_DIR/.claude/plugins/installed_plugins.json"
  local local_manifest="$HOME/.claude/plugins/installed_plugins.json"
  [ -f "$repo_manifest" ] || { warn "no repo plugin manifest"; return 0; }
  [ -f "$local_manifest" ] || { warn "no local plugin manifest yet"; return 0; }
  command -v python3 &>/dev/null || { warn "python3 not found — skipping plugin diff"; return 0; }
  info "Checking Claude plugins against the repo manifest..."
  python3 - "$repo_manifest" "$local_manifest" <<'PY'
import json, sys

def names(path):
    try:
        with open(path) as fh:
            return set(json.load(fh).get("plugins", {}))
    except Exception as exc:
        print(f"[warn] could not read {path}: {exc}")
        return set()

repo, local = names(sys.argv[1]), names(sys.argv[2])
missing, extra = sorted(repo - local), sorted(local - repo)
if not missing and not extra:
    print("[ok]   Claude plugins match the repo manifest")
for p in missing:
    print(f"[warn] in repo manifest but NOT installed here: {p}")
for p in extra:
    print(f"[warn] installed here but NOT in repo manifest: {p}")
PY
}

# Dangling links this script used to create, plus any .bak it left behind.
step_check_leftovers() {
  info "Scanning for dangling links and stale backups..."
  local found=0 p
  for dir in "$HOME" "$HOME/.claude" "$HOME/.claude/plugins" "$HOME/.config"; do
    [ -d "$dir" ] || continue
    while IFS= read -r p; do
      warn "dangling link: $p -> $(readlink "$p")"
      found=$((found + 1))
    done < <(find "$dir" -maxdepth 1 -type l ! -exec test -e {} \; -print 2>/dev/null)
    while IFS= read -r p; do
      warn "stale backup:  $p"
      found=$((found + 1))
    done < <(find "$dir" -maxdepth 1 -name '*.bak*' -print 2>/dev/null)
  done
  (( found == 0 )) && success "no dangling links or stale backups" || warn "$found leftover(s) — safe to delete once you've checked them"
  return 0
}

# ------------------------------------------
# 8. Set up private env vars
# ------------------------------------------
step_env_vars() {
  ENV_VARS_FILE="$DOTFILES_DIR/.zshrc-env-vars"
  ENV_VARS_EXAMPLE="$DOTFILES_DIR/.zshrc-env-vars.example"

  if [ -f "$ENV_VARS_FILE" ]; then
    success "Private env vars file already exists"
  else
    if [ -f "$ENV_VARS_EXAMPLE" ]; then
      cp "$ENV_VARS_EXAMPLE" "$ENV_VARS_FILE"
      success "Created .zshrc-env-vars from example template"
      warn "Remember to fill in your private values in: $ENV_VARS_FILE"
    else
      touch "$ENV_VARS_FILE"
      success "Created empty .zshrc-env-vars"
      warn "Add your private environment variables to: $ENV_VARS_FILE"
    fi
  fi

  # Load env vars so subsequent steps can use them
  if [ -f "$ENV_VARS_FILE" ]; then
    set +u
    source "$ENV_VARS_FILE"
    set -u
  fi
}

# ------------------------------------------
# 9. Install Claude Code plugins
# ------------------------------------------
step_claude_plugins() {
  CLAUDE_PLUGINS_MANIFEST="$DOTFILES_DIR/.claude/plugins/installed_plugins.json"
  if [ -f "$CLAUDE_PLUGINS_MANIFEST" ] && command -v claude &>/dev/null; then
    info "Installing Claude plugins from manifest..."
    while IFS= read -r plugin; do
      claude plugin install "$plugin" &>/dev/null && success "Claude plugin installed: $plugin" || warn "Claude plugin already installed or failed: $plugin"
    done < <(python3 -c "import json,sys; [print(k) for k in json.load(open('$CLAUDE_PLUGINS_MANIFEST'))['plugins']]")
    success "Claude plugins processed"
  elif [ -f "$CLAUDE_PLUGINS_MANIFEST" ] && ! command -v claude &>/dev/null; then
    warn "claude CLI not in PATH — skipping plugin install (re-run after adding Claude to PATH)"
  fi
}

# ------------------------------------------
# 10. Set up machine-specific local overrides
# ------------------------------------------
step_local_overrides() {
  LOCAL_FILE="$DOTFILES_DIR/.zshrc-local"
  LOCAL_EXAMPLE="$DOTFILES_DIR/.zshrc-local.example"

  if [ -f "$LOCAL_FILE" ]; then
    success "Machine-specific overrides file already exists"
  else
    if [ -f "$LOCAL_EXAMPLE" ]; then
      cp "$LOCAL_EXAMPLE" "$LOCAL_FILE"
      success "Created .zshrc-local from example template"
      warn "Add machine-specific overrides in: $LOCAL_FILE"
    else
      touch "$LOCAL_FILE"
      success "Created empty .zshrc-local"
      warn "Add machine-specific overrides in: $LOCAL_FILE"
    fi
  fi
}

# ------------------------------------------
# Run steps
# ------------------------------------------
if $CHECK_ONLY; then
  info "Checking this machine against $REPO_DIR — nothing will be changed."
  echo ""
  step_symlinks
  echo ""
  step_check_leftovers
  echo ""
  step_check_claude_plugins
  echo ""
  step_check_packages
  echo ""
  # settings.json is machine-owned, so --check only reports; --sync-lists applies.
  node "$DOTFILES_DIR/.claude/scripts/settings-drift.js" --check || true
  echo ""
  if (( LINKS_DRIFT > 0 )); then
    info "Fix what's only missing:  ./install.sh --sync"
    info "Take over drifted paths:  ./install.sh   (backs up first)"
  fi
  exit 0
fi

if $IS_ARCH; then
  run_step "1. Install system packages (pacman)" step_packages
else
  run_step "1. Install Homebrew"             step_homebrew
  run_step "2. Install Homebrew packages"    step_packages
fi
run_step "3. Install oh-my-zsh"            step_ohmyzsh
run_step "4. Install oh-my-zsh plugins"    step_omz_plugins
run_step "5. Install spaceship theme"      step_spaceship
run_step "6. Install mise runtimes"        step_mise
run_step "7. Create symlinks"              step_symlinks
run_step "8. Set up private env vars"      step_env_vars
run_step "9. Install Claude Code plugins"  step_claude_plugins
run_step "10. Machine-local overrides"     step_local_overrides

# ------------------------------------------
# Done!
# ------------------------------------------
echo ""
if (( ${#FAILED_STEPS[@]} )); then
  echo -e "${YELLOW}============================================${NC}"
  echo -e "${YELLOW} Setup finished with ${#FAILED_STEPS[@]} failed step(s):${NC}"
  for s in "${FAILED_STEPS[@]}"; do
    echo -e "${YELLOW}   • $s${NC}"
  done
  echo -e "${YELLOW}============================================${NC}"
else
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN} Setup complete!${NC}"
  echo -e "${GREEN}============================================${NC}"
fi
echo ""
echo "Next steps:"
echo "  1. Fill in your private env vars:"
echo "     $DOTFILES_DIR/.zshrc-env-vars"
echo "  2. Add machine-specific overrides (e.g. PATH tweaks):"
echo "     $DOTFILES_DIR/.zshrc-local"
echo "  3. Restart your terminal or run:"
echo "     source ~/.zshrc"
echo ""
