#!/usr/bin/env bash
set -euo pipefail

# ============================================
# t-configs bootstrap script
# ============================================
# Idempotent — safe to run multiple times.
# Usage: ./install.sh           # interactive (prompts per step)
#        ./install.sh --yes     # non-interactive (run everything)
#        ./install.sh --dry-run # show what would run, no changes
# ============================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOTFILES_DIR="$REPO_DIR/dotfiles"

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
for arg in "$@"; do
  [[ "$arg" == "--yes"     || "$arg" == "-y" ]] && YES_ALL=true
  [[ "$arg" == "--dry-run" || "$arg" == "-n" ]] && DRY_RUN=true
done

# ------------------------------------------
# Brew PATH — run unconditionally so step 2
# works even when step 1 is skipped
# ------------------------------------------
if [[ "$OSTYPE" == linux* ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null)" || true
else
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
fi

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

  if ! ( set -euo pipefail; $fn ); then
    error "Step failed: $label"
    FAILED_STEPS+=("$label")
  fi
}

# ------------------------------------------
# 1. Install Homebrew
# ------------------------------------------
step_homebrew() {
  if command -v brew &>/dev/null; then
    success "Homebrew already installed"
  else
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    success "Homebrew installed"
    # Re-eval shellenv so brew is in PATH immediately after fresh install
    if [[ "$OSTYPE" == linux* ]]; then
      eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null)" || true
    else
      eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
    fi
  fi
}

# ------------------------------------------
# 2. Install Homebrew packages
# ------------------------------------------
step_brew_packages() {
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
  if [ -d "$HOME/.oh-my-zsh" ]; then
    success "oh-my-zsh already installed"
  else
    info "Installing oh-my-zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
    success "oh-my-zsh installed"
  fi
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
create_symlink() {
  local src="$1"
  local dest="$2"

  if [ -L "$dest" ]; then
    local current_target
    current_target="$(readlink "$dest")"
    if [ "$current_target" = "$src" ]; then
      success "Symlink already correct: $dest -> $src"
      return
    else
      warn "Symlink exists but points elsewhere: $dest -> $current_target"
      warn "Updating to: $dest -> $src"
      ln -sf "$src" "$dest"
      success "Symlink updated: $dest -> $src"
    fi
  elif [ -f "$dest" ] || [ -d "$dest" ]; then
    warn "Existing file/directory at $dest — backing up to ${dest}.bak"
    mv "$dest" "${dest}.bak"
    ln -s "$src" "$dest"
    success "Symlink created (original backed up): $dest -> $src"
  else
    ln -s "$src" "$dest"
    success "Symlink created: $dest -> $src"
  fi
}

step_symlinks() {
  info "Creating symlinks..."
  create_symlink "$DOTFILES_DIR/.zshrc"      "$HOME/.zshrc"
  create_symlink "$DOTFILES_DIR/.zshenv"     "$HOME/.zshenv"
  create_symlink "$DOTFILES_DIR/.gitconfig"  "$HOME/.gitconfig"
  create_symlink "$DOTFILES_DIR/.hushlogin"  "$HOME/.hushlogin"

  # Neovim config
  mkdir -p "$HOME/.config"
  create_symlink "$DOTFILES_DIR/.config/nvim" "$HOME/.config/nvim"

  mkdir -p "$HOME/.cursor"

  # Cursor User settings (macOS vs Linux paths)
  if [[ "$OSTYPE" == darwin* ]]; then
    CURSOR_USER_DIR="$HOME/Library/Application Support/Cursor/User"
  else
    CURSOR_USER_DIR="$HOME/.config/Cursor/User"
  fi
  mkdir -p "$CURSOR_USER_DIR"
  create_symlink "$DOTFILES_DIR/.config/Cursor/User/settings.json" "$CURSOR_USER_DIR/settings.json"

  # ── Claude Code (.claude is the first-class citizen) ──────────────────
  mkdir -p "$HOME/.claude"

  # Directories (symlink entire dirs)
  create_symlink "$DOTFILES_DIR/.claude/skills"   "$HOME/.claude/skills"
  create_symlink "$DOTFILES_DIR/.claude/rules"    "$HOME/.claude/rules"
  create_symlink "$DOTFILES_DIR/.claude/agents"   "$HOME/.claude/agents"
  create_symlink "$DOTFILES_DIR/.claude/commands" "$HOME/.claude/commands"
  create_symlink "$DOTFILES_DIR/.claude/hooks"    "$HOME/.claude/hooks"
  create_symlink "$DOTFILES_DIR/.claude/scripts"  "$HOME/.claude/scripts"

  # settings.json is COPIED (not symlinked) because Claude Code uses atomic writes
  # (write-temp + rename) which replace symlinks with regular files. Copy it so
  # the app can write settings normally. To sync changes back, run:
  #   cp ~/.claude/settings.json t-configs/dotfiles/.claude/settings.json
  if [ -f "$HOME/.claude/settings.json" ] && [ ! -L "$HOME/.claude/settings.json" ]; then
    info "settings.json already exists as a regular file (good — Claude Code atomic writes require this)"
  else
    [ -L "$HOME/.claude/settings.json" ] && warn "Replacing settings.json symlink with a copy (symlinks break Claude Code atomic writes)" && rm "$HOME/.claude/settings.json"
    cp "$DOTFILES_DIR/.claude/settings.json" "$HOME/.claude/settings.json"
    success "settings.json copied to ~/.claude/"
  fi
  create_symlink "$DOTFILES_DIR/.claude/AGENTS.md"              "$HOME/.claude/AGENTS.md"
  create_symlink "$DOTFILES_DIR/.claude/README.md"              "$HOME/.claude/README.md"
  create_symlink "$DOTFILES_DIR/.claude/plugin.json"            "$HOME/.claude/plugin.json"
  create_symlink "$DOTFILES_DIR/.claude/marketplace.json"       "$HOME/.claude/marketplace.json"
  create_symlink "$DOTFILES_DIR/.claude/statusline-command.sh"  "$HOME/.claude/statusline-command.sh"
  create_symlink "$DOTFILES_DIR/.claude/the-security-guide.md"  "$HOME/.claude/the-security-guide.md"
  create_symlink "$DOTFILES_DIR/.claude/PLUGIN_SCHEMA_NOTES.md" "$HOME/.claude/PLUGIN_SCHEMA_NOTES.md"

  # Plugins: only the manifest, not cache/state
  mkdir -p "$HOME/.claude/plugins"
  create_symlink "$DOTFILES_DIR/.claude/plugins/installed_plugins.json" "$HOME/.claude/plugins/installed_plugins.json"

  # settings.local.json: create from example if it doesn't exist (account-specific overrides)
  if [ ! -f "$HOME/.claude/settings.local.json" ]; then
    if [ -f "$DOTFILES_DIR/.claude/settings.local.json.example" ]; then
      cp "$DOTFILES_DIR/.claude/settings.local.json.example" "$HOME/.claude/settings.local.json"
      success "Created settings.local.json from example (edit for your account preferences)"
    fi
  else
    success "settings.local.json already exists (account-specific overrides preserved)"
  fi

  # ── Other tools (symlink from .claude, not .agent) ────────────────────
  create_symlink "$DOTFILES_DIR/.claude/skills" "$HOME/.cursor/skills"

  # ── Gemini CLI ────────────────────
  mkdir -p "$HOME/.gemini/antigravity"

  # Support both legacy/antigravity and modern paths
  create_symlink "$DOTFILES_DIR/.claude/skills"   "$HOME/.gemini/antigravity/skills"
  create_symlink "$DOTFILES_DIR/.claude/skills"   "$HOME/.gemini/skills"
  create_symlink "$DOTFILES_DIR/.claude/agents"   "$HOME/.gemini/agents"
  create_symlink "$DOTFILES_DIR/.claude/rules"    "$HOME/.gemini/rules"
  create_symlink "$DOTFILES_DIR/.claude/hooks"    "$HOME/.gemini/hooks"
  create_symlink "$DOTFILES_DIR/.claude/scripts"  "$HOME/.gemini/scripts"
  create_symlink "$DOTFILES_DIR/.claude/AGENTS.md"              "$HOME/.gemini/AGENTS.md"
  create_symlink "$DOTFILES_DIR/.claude/the-security-guide.md"  "$HOME/.gemini/the-security-guide.md"
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
# 10. Install Cursor extensions
# ------------------------------------------
step_cursor_extensions() {
  CURSOR_EXTENSIONS_FILE="$DOTFILES_DIR/.config/Cursor/extensions.txt"
  if [ -f "$CURSOR_EXTENSIONS_FILE" ] && command -v cursor &>/dev/null; then
    info "Installing Cursor extensions from list..."
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%%#*}"
      line="${line#"${line%%[![:space:]]*}"}"
      [ -z "$line" ] && continue
      cursor --install-extension "$line" &>/dev/null || true
    done < "$CURSOR_EXTENSIONS_FILE"
    success "Cursor extensions processed (already-installed extensions are skipped)"
  elif [ -f "$CURSOR_EXTENSIONS_FILE" ] && ! command -v cursor &>/dev/null; then
    warn "Cursor CLI not in PATH — skip extension install or add Cursor to PATH and re-run"
  fi
}

# ------------------------------------------
# 11. Set up machine-specific local overrides
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
run_step "1. Install Homebrew"             step_homebrew
run_step "2. Install Homebrew packages"    step_brew_packages
run_step "3. Install oh-my-zsh"            step_ohmyzsh
run_step "4. Install oh-my-zsh plugins"    step_omz_plugins
run_step "5. Install spaceship theme"      step_spaceship
run_step "6. Install mise runtimes"        step_mise
run_step "7. Create symlinks"              step_symlinks
run_step "8. Set up private env vars"      step_env_vars
run_step "9. Install Claude Code plugins"  step_claude_plugins
run_step "10. Install Cursor extensions"   step_cursor_extensions
run_step "11. Machine-local overrides"     step_local_overrides

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
