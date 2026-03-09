# Import private env variables
# Resolve dotfiles path from this file's location (works when repo is anywhere, e.g. ~/t-configs or /mnt/c/.../t-configs)
dotfiles_path="${${(%):-%x}:A:h}"
[[ -z "$dotfiles_path" ]] && dotfiles_path="$HOME/t-configs/dotfiles"
# Add Homebrew to PATH early on Linux/WSL so direnv, rbenv, mise are found below
[[ "$OSTYPE" == linux* ]] && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null)" || true
source $dotfiles_path/.zshrc-env-vars

# Path to your oh-my-zsh installation
export ZSH="$HOME/.oh-my-zsh"

# Theme
ZSH_THEME="spaceship"

# Plugins
plugins=(git deno colored-man-pages zsh-syntax-highlighting zsh-autosuggestions)

source $ZSH/oh-my-zsh.sh

# ===== Aliases =====

# General
export LS_COLORS="di=1;36:ln=35:so=32:pi=33:ex=1;31:bd=34;46:cd=36;43:su=37;41:sg=30;46:tw=30;42:ow=37;43"
alias lsa="ls -al"

# Config shortcuts
alias zshconf="nvim ~/.zshrc"
alias zshre="source ~/.zshrc; clear"
alias zshr="source ~/.zshrc"
alias brewup="brew update; brew upgrade; brew cleanup; brew doctor"
alias codeconf="code $HOME/t-configs"

# Navigation
alias cdcode="cd ~/code"
alias notes="cd $HOME/Library/CloudStorage/Dropbox/Tegan/Obsidian/tegan"

# ===== Functions =====

# cd up to n dirs (usage: cd.. 10 or cd.. dir)
function cd_up() {
  case $1 in
    *[!0-9]*)
      cd $( pwd | sed -r "s|(.*/$1[^/]*/).*|\1|" )
      ;;
    *)
      cd $(printf "%0.0s../" $(seq 1 $1));
    ;;
  esac
}
alias 'cd..'='cd_up'

# ===== Environment Variables =====

# Build flags (for Python packages with native dependencies)
brew_prefix="/opt/homebrew"
export LDFLAGS="-L${brew_prefix}/opt/zlib/lib -L${brew_prefix}/opt/bzip2/lib -L${brew_prefix}/opt/openssl/lib -L${brew_prefix}/opt/libomp/lib"
export CPPFLAGS="-I${brew_prefix}/opt/zlib/include -I${brew_prefix}/opt/bzip2/include -I${brew_prefix}/opt/openblas/include -I${brew_prefix}/opt/openssl/include -I${brew_prefix}/opt/libomp/include"
export PKG_CONFIG_PATH="${brew_prefix}/opt/openblas/lib/pkgconfig"

# ===== PATH =====

eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
export PATH="$PATH:$HOME/.local/bin"
export PATH="$PATH:$HOME/.foundry/bin"
export PATH="${brew_prefix}/opt/mysql-client/bin:$PATH"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# ===== Tool Initialization =====

command -v direnv &>/dev/null && eval "$(direnv hook zsh)"
command -v rbenv &>/dev/null && eval "$(rbenv init - zsh)"
command -v mise &>/dev/null && eval "$(mise activate zsh)"

# Initialize zsh completions
autoload -Uz compinit
compinit

# Docker Desktop CLI completions (if present)
# The following lines have been added by Docker Desktop to enable Docker CLI completions.
fpath=($HOME/.docker/completions $fpath)
autoload -Uz compinit
compinit
# End of Docker CLI completions

# ===== Machine-Specific Overrides =====
# Source local overrides last so they can extend or override anything above
[ -f "$dotfiles_path/.zshrc-local" ] && source "$dotfiles_path/.zshrc-local"

# opencode
export PATH="$HOME/.opencode/bin:$PATH"
