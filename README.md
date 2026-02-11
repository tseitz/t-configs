# t-configs

Personal dotfiles and system configuration. Clone once, run the install script, and you're set up.

## Quick Start

```bash
git clone git@github.com:tseitz/t-configs.git ~/t-configs
cd ~/t-configs
./install.sh
```

The install script is idempotent — safe to run multiple times. It will:

1. Install [Homebrew](https://brew.sh) (if not already installed)
2. Install all packages from the `Brewfile`
3. Install [oh-my-zsh](https://ohmyz.sh) with custom plugins and spaceship theme
4. Install default runtimes via [mise](https://mise.jdx.dev) (Node, etc. from `mise.toml`)
5. Symlink dotfiles to their expected locations
6. Generate Cursor MCP config from template (substituting API keys from env vars)
7. Install Cursor extensions from `dotfiles/.config/Cursor/extensions.txt` (if Cursor CLI is in PATH)
8. Create `.zshrc-env-vars` (private secrets) and `.zshrc-local` (machine-specific overrides) from example templates

## Private Environment Variables

Secrets and API keys live in `dotfiles/.zshrc-env-vars`, which is **gitignored**.

On a fresh machine, the install script creates this file from the example template. Fill in your values:

```bash
nvim ~/t-configs/dotfiles/.zshrc-env-vars
```

See `dotfiles/.zshrc-env-vars.example` for the full list of supported variables.

## Machine-Specific Overrides

Per-machine customizations (e.g. different PATH entries, tool versions) go in `dotfiles/.zshrc-local`, which is **gitignored**.

This file is sourced **last** in `.zshrc`, so anything in it overrides or extends the shared defaults. On a fresh machine, the install script creates it from the example template:

```bash
nvim ~/t-configs/dotfiles/.zshrc-local
```

See `dotfiles/.zshrc-local.example` for examples.

## Cursor Settings and Extensions

**Settings** — Your Cursor `settings.json` is symlinked from this repo. To pull your current settings into the repo (e.g. from this machine):

- **macOS:**
  `cp ~/Library/Application\ Support/Cursor/User/settings.json ~/t-configs/dotfiles/.config/Cursor/User/settings.json`
- **Linux:**
  `cp ~/.config/Cursor/User/settings.json ~/t-configs/dotfiles/.config/Cursor/User/settings.json`

Then commit and push. On a new machine, `install.sh` will symlink this file into the right place for your OS.

**MCP Servers** — `dotfiles/.cursor/mcp.json` is a template with `REF_API_KEY_PLACEHOLDER`. The install script copies it to `~/.cursor/mcp.json` and substitutes `REF_API_KEY` from your env vars. To add a new MCP server, edit the template and re-run `install.sh`.

**Extensions** — Extensions are not synced as files; they're installed from a list of IDs. To export your current extensions into the repo:

```bash
cursor --list-extensions > ~/t-configs/dotfiles/.config/Cursor/extensions.txt
```

Edit the file to remove any you don't want. On a new machine, `install.sh` will run `cursor --install-extension <id>` for each line (when the Cursor CLI is in PATH). On macOS, enable "Shell Command: Install 'cursor' command in PATH" in Cursor (Command Palette → "Shell Command") so `cursor` is available in the terminal.

## What's Included

| File | Description |
|------|-------------|
| `dotfiles/.zshrc` | Zsh configuration — aliases, functions, PATH, tool init |
| `dotfiles/.zshenv` | Zsh environment — Homebrew PATH, Cargo/Rust |
| `dotfiles/.zshrc-env-vars.example` | Template for private environment variables |
| `dotfiles/.zshrc-local.example` | Template for machine-specific overrides |
| `dotfiles/.gitconfig` | Git configuration — user, LFS, default branch, pull strategy |
| `dotfiles/.hushlogin` | Suppresses macOS "Last login" terminal banner |
| `dotfiles/.config/nvim/` | Neovim configuration (LazyVim) |
| `dotfiles/.cursor/mcp.json` | Cursor MCP server configuration (template with placeholders) |
| `dotfiles/.config/Cursor/User/settings.json` | Cursor editor settings |
| `dotfiles/.config/Cursor/extensions.txt` | List of Cursor extension IDs (one per line) |
| `mise.toml` | Default runtimes managed by mise (e.g. Node) |
| `Brewfile` | Homebrew packages, casks, and dependencies |
| `install.sh` | Bootstrap script for new machines |

## Updating

After pulling changes, re-run the install script to pick up any new packages or symlinks:

```bash
cd ~/t-configs
git pull
./install.sh
```

## Adding a New Dotfile

1. Add the file to `dotfiles/`
2. Add a `create_symlink` line in `install.sh`:
   ```bash
   create_symlink "$DOTFILES_DIR/.your-config" "$HOME/.your-config"
   ```
3. Run `./install.sh` to create the symlink
