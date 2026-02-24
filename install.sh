#!/usr/bin/env bash
set -euo pipefail

# ============================================
# t-configs bootstrap script
# ============================================
# Idempotent — safe to run multiple times.
# Usage: ./install.sh
# ============================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOTFILES_DIR="$REPO_DIR/dotfiles"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[info]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $1"; }
error()   { echo -e "${RED}[err]${NC}  $1"; }

# ------------------------------------------
# 1. Install Homebrew
# ------------------------------------------
if command -v brew &>/dev/null; then
  success "Homebrew already installed"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for the rest of this script
  eval "$(/opt/homebrew/bin/brew shellenv)"
  success "Homebrew installed"
fi

# ------------------------------------------
# 2. Install Homebrew packages
# ------------------------------------------
if [ -f "$REPO_DIR/Brewfile" ]; then
  info "Installing Homebrew packages from Brewfile..."
  brew bundle --file="$REPO_DIR/Brewfile"
  success "Homebrew packages installed"
else
  warn "No Brewfile found, skipping"
fi

# ------------------------------------------
# 3. Install oh-my-zsh
# ------------------------------------------
if [ -d "$HOME/.oh-my-zsh" ]; then
  success "oh-my-zsh already installed"
else
  info "Installing oh-my-zsh..."
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
  success "oh-my-zsh installed"
fi

# ------------------------------------------
# 4. Install oh-my-zsh custom plugins
# ------------------------------------------
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

# ------------------------------------------
# 5. Install spaceship prompt theme
# ------------------------------------------
SPACESHIP_DIR="$ZSH_CUSTOM/themes/spaceship-prompt"
if [ -d "$SPACESHIP_DIR" ]; then
  success "Spaceship theme already installed"
else
  info "Installing spaceship prompt theme..."
  git clone https://github.com/spaceship-prompt/spaceship-prompt.git "$SPACESHIP_DIR" --depth=1
  ln -sf "$SPACESHIP_DIR/spaceship.zsh-theme" "$ZSH_CUSTOM/themes/spaceship.zsh-theme"
  success "Spaceship theme installed"
fi

# ------------------------------------------
# 6. Install mise runtimes (Node, etc.)
# ------------------------------------------
if command -v mise &>/dev/null; then
  info "Installing default runtimes via mise (Node from mise.toml)..."
  (cd "$REPO_DIR" && mise install)
  mise use -g node@latest
  success "mise runtimes installed (Node available by default)"
else
  warn "mise not found, skipping runtime install (run install.sh again after opening a new terminal)"
fi

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

info "Creating symlinks..."
create_symlink "$DOTFILES_DIR/.zshrc"      "$HOME/.zshrc"
create_symlink "$DOTFILES_DIR/.zshenv"     "$HOME/.zshenv"
create_symlink "$DOTFILES_DIR/.gitconfig"  "$HOME/.gitconfig"
create_symlink "$DOTFILES_DIR/.hushlogin"  "$HOME/.hushlogin"

# Neovim config
mkdir -p "$HOME/.config"
create_symlink "$DOTFILES_DIR/.config/nvim" "$HOME/.config/nvim"

# Cursor MCP config (copy from template + substitute API keys)
# Load env vars so secrets are available for substitution
ENV_VARS_FILE="$DOTFILES_DIR/.zshrc-env-vars"
if [ -f "$ENV_VARS_FILE" ]; then
  set +u  # env vars file may reference unset variables
  source "$ENV_VARS_FILE"
  set -u
fi

MCP_FILE="$DOTFILES_DIR/.cursor/mcp.json"
MCP_TEMPLATE="$DOTFILES_DIR/.cursor/mcp.json.template"
# Generate mcp.json from template if it doesn't exist or still has placeholders
if [ -f "$MCP_FILE" ] && ! grep -q "REF_API_KEY_PLACEHOLDER" "$MCP_FILE"; then
  success "Cursor MCP config already exists (with keys filled in)"
else
  cp "$MCP_TEMPLATE" "$MCP_FILE"
  if [ -n "${REF_API_KEY:-}" ]; then
    sed -i '' "s|REF_API_KEY_PLACEHOLDER|$REF_API_KEY|g" "$MCP_FILE"
    success "Cursor MCP config generated with API keys"
  else
    success "Cursor MCP config generated (fill in REF_API_KEY_PLACEHOLDER in $MCP_FILE)"
    warn "Or set REF_API_KEY in .zshrc-env-vars and re-run install.sh"
  fi
fi
mkdir -p "$HOME/.cursor"
create_symlink "$MCP_FILE" "$HOME/.cursor/mcp.json"

# Cursor User settings (macOS vs Linux paths)
if [[ "$OSTYPE" == darwin* ]]; then
  CURSOR_USER_DIR="$HOME/Library/Application Support/Cursor/User"
else
  CURSOR_USER_DIR="$HOME/.config/Cursor/User"
fi
mkdir -p "$CURSOR_USER_DIR"
create_symlink "$DOTFILES_DIR/.config/Cursor/User/settings.json" "$CURSOR_USER_DIR/settings.json"

# Cursor extensions (install from list if cursor CLI is available)
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

# Agent skills (single source in t-configs, symlinked to Cursor and Antigravity)
create_symlink "$DOTFILES_DIR/.agent/skills" "$HOME/.cursor/skills"
mkdir -p "$HOME/.gemini/antigravity"
create_symlink "$DOTFILES_DIR/.agent/skills" "$HOME/.gemini/antigravity/skills"

# ------------------------------------------
# 8. Set up private env vars
# ------------------------------------------
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

# ------------------------------------------
# 9. Set up machine-specific local overrides
# ------------------------------------------
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

# ------------------------------------------
# Done!
# ------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Setup complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Fill in your private env vars:"
echo "     $ENV_VARS_FILE"
echo "  2. Add machine-specific overrides (e.g. PATH tweaks):"
echo "     $LOCAL_FILE"
echo "  3. Restart your terminal or run:"
echo "     source ~/.zshrc"
echo ""
