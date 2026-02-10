# Import private env variables
ROOT="$HOME"
dotfiles_path="$ROOT/t-configs/dotfiles"
source $dotfiles_path/.zshrc-env-vars

# Path to your oh-my-zsh installation
export ZSH="$ROOT/.oh-my-zsh"

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
alias codeconf="code $ROOT/t-configs"

# Navigation
alias cdcode="cd ~/code"
alias notes="cd $ROOT/Library/CloudStorage/Dropbox/Tegan/Obsidian/tegan"

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

export PATH="$PATH:$ROOT/.local/bin"
export PATH="$PATH:$ROOT/.foundry/bin"
export PATH="${brew_prefix}/opt/mysql-client/bin:$PATH"

# pnpm
export PNPM_HOME="$ROOT/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# ===== Tool Initialization =====

eval "$(direnv hook zsh)"
eval "$(rbenv init - zsh)"

# Deno
eval "$(deno env --env-file)"

# Initialize zsh completions
autoload -Uz compinit
compinit

eval "$(mise activate zsh)"
