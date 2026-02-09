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

declare -A plugins=(
  ["zsh-syntax-highlighting"]="https://github.com/zsh-users/zsh-syntax-highlighting.git"
  ["zsh-autosuggestions"]="https://github.com/zsh-users/zsh-autosuggestions.git"
)

for plugin in "${!plugins[@]}"; do
  plugin_dir="$ZSH_CUSTOM/plugins/$plugin"
  if [ -d "$plugin_dir" ]; then
    success "Plugin '$plugin' already installed"
  else
    info "Installing oh-my-zsh plugin: $plugin..."
    git clone "${plugins[$plugin]}" "$plugin_dir"
    success "Plugin '$plugin' installed"
  fi
done

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
# 6. Create symlinks
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
  elif [ -f "$dest" ]; then
    warn "Regular file exists at $dest — backing up to ${dest}.bak"
    mv "$dest" "${dest}.bak"
    ln -s "$src" "$dest"
    success "Symlink created (original backed up): $dest -> $src"
  else
    ln -s "$src" "$dest"
    success "Symlink created: $dest -> $src"
  fi
}

info "Creating symlinks..."
create_symlink "$DOTFILES_DIR/.zshrc" "$HOME/.zshrc"

# ------------------------------------------
# 7. Set up private env vars
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
echo "  2. Restart your terminal or run:"
echo "     source ~/.zshrc"
echo ""
