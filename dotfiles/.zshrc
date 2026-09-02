# Import private env variables
# Resolve dotfiles path from this file's location (works when repo is anywhere, e.g. ~/t-configs or /mnt/c/.../t-configs)
dotfiles_path="${${(%):-%x}:A:h}"
[[ -z "$dotfiles_path" ]] && dotfiles_path="$HOME/t-configs/dotfiles"
# Add Homebrew to PATH early so direnv and mise are found below.
# Arch installs these through pacman (see Pacfile) and has no brew prefix at all,
# so the eval is skipped rather than left to fail quietly on every shell start.
if [[ "$OSTYPE" == linux* ]] && [[ -r /etc/os-release ]] && grep -qE '^(ID|ID_LIKE)=.*arch' /etc/os-release; then
  IS_ARCH=1
elif [[ "$OSTYPE" == linux* ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null)" || true
else
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
fi
# Omarchy PATH and env first: .zshrc activates mise below, and env-bootstrap is
# what puts mise's shims on PATH.
[ -f "$dotfiles_path/.zshrc-omarchy" ] && source "$dotfiles_path/.zshrc-omarchy" env

[ -f "$dotfiles_path/.zshrc-env-vars" ] && source "$dotfiles_path/.zshrc-env-vars"

# Path to your oh-my-zsh installation
export ZSH="$HOME/.oh-my-zsh"

# Prompt comes from starship, initialised below, so oh-my-zsh loads no theme.
# starship is one binary across bash/zsh and macOS/Linux, and its colours are
# ANSI, so it follows an Omarchy theme switch. Set ZSH_THEME in .zshrc-local to
# go back to an oh-my-zsh theme.
ZSH_THEME=""

# Plugins
plugins=(git deno colored-man-pages zsh-syntax-highlighting zsh-autosuggestions)

source $ZSH/oh-my-zsh.sh

# ===== Aliases =====

# General
export LS_COLORS="di=1;36:ln=35:so=32:pi=33:ex=1;31:bd=34;46:cd=36;43:su=37;41:sg=30;46:tw=30;42:ow=37;43"
alias lsa="ls -al"
export HOMEBREW_NO_UPGRADE_AUTO_UPDATES_CASKS=1

# Config shortcuts
alias zshconf="nvim ~/.zshrc"
alias zshre="source ~/.zshrc; clear"
alias zshr="source ~/.zshrc"
if command -v omarchy &>/dev/null; then
  # `omarchy update` snapshots the filesystem before it changes anything, then
  # runs the keyring, system and AUR packages, migrations, mise tools and orphan
  # pruning in the order its migrations expect. A bare `yay -Syu` skips all of
  # that, including the snapshot to roll back to. mise tools cover claude here.
  # omup is the honest name; brewup stays because the muscle memory is worth
  # more than the tidiness. Both run the full machine update, which includes the
  # mise step that `mup` runs on its own.
  alias omup="omarchy update"
  alias brewup="omarchy update"
elif [[ -n "${IS_ARCH:-}" ]]; then
  alias brewup="yay -Syu; claude upgrade;"
else
  alias brewup="brew update; brew upgrade -y; brew cleanup; brew doctor; claude upgrade;"
fi
alias codeconf="code $HOME/t-configs"
alias claw="claude --dangerously-skip-permissions"

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

# Build flags (for Python packages with native dependencies — macOS only)
if [[ "$OSTYPE" == darwin* ]]; then
  brew_prefix="${HOMEBREW_PREFIX:-/opt/homebrew}"
  export LDFLAGS="-L${brew_prefix}/opt/zlib/lib -L${brew_prefix}/opt/bzip2/lib -L${brew_prefix}/opt/openssl/lib -L${brew_prefix}/opt/libomp/lib"
  export CPPFLAGS="-I${brew_prefix}/opt/zlib/include -I${brew_prefix}/opt/bzip2/include -I${brew_prefix}/opt/openblas/include -I${brew_prefix}/opt/openssl/include -I${brew_prefix}/opt/libomp/include"
  export PKG_CONFIG_PATH="${brew_prefix}/opt/openblas/lib/pkgconfig"
fi

# ===== PATH =====
export PATH="$PATH:$HOME/.local/bin"
export PATH="$PATH:$HOME/.foundry/bin"
export PATH="$HOME/.opencode/bin:$PATH"
[[ "$OSTYPE" == darwin* ]] && export PATH="${HOMEBREW_PREFIX:-/opt/homebrew}/opt/mysql-client/bin:$PATH"

# pnpm — ~/Library is macOS-only; elsewhere pnpm defaults to the XDG data dir
if [[ "$OSTYPE" == darwin* ]]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm"
fi
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# Obsidian CLI binary (macOS app bundle)
[[ -d "/Applications/Obsidian.app/Contents/MacOS" ]] && export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"

# ===== Tool Initialization =====

command -v starship &>/dev/null && eval "$(starship init zsh)"
command -v direnv &>/dev/null && eval "$(direnv hook zsh)"
command -v mise &>/dev/null && eval "$(mise activate zsh)"

# Initialize zsh completions (Docker fpath added first so its completions are included)
fpath=($HOME/.docker/completions $fpath)
autoload -Uz compinit
compinit

# ===== Omarchy =====
# Aliases, functions and keybindings, sourced AFTER the personal ones above so
# Omarchy wins any name they share. Reclaim individual names below.
[ -f "$dotfiles_path/.zshrc-omarchy" ] && source "$dotfiles_path/.zshrc-omarchy" shell

# ===== Reclaimed from Omarchy =====
# Names Omarchy also defines, kept as mine on every machine. Tracked, unlike
# .zshrc-local, so the choice travels. Adding a line here is the whole override
# mechanism: it runs after Omarchy, so it wins.
alias lsa="ls -al"          # Omarchy: ls -a

# ===== Machine-Specific Overrides =====
# Source local overrides last so they can extend or override anything above
[ -f "$dotfiles_path/.zshrc-local" ] && source "$dotfiles_path/.zshrc-local"
