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

**MCP Servers** — `dotfiles/.cursor/mcp.json.template` contains MCP server config with `REF_API_KEY_PLACEHOLDER`. The install script copies it to `~/.cursor/mcp.json` and substitutes `REF_API_KEY` from your env vars. To add a new MCP server, edit the template and re-run `install.sh`.

**Extensions** — Extensions are not synced as files; they're installed from a list of IDs. To export your current extensions into the repo:

```bash
cursor --list-extensions > ~/t-configs/dotfiles/.config/Cursor/extensions.txt
```

Edit the file to remove any you don't want. On a new machine, `install.sh` will run `cursor --install-extension <id>` for each line (when the Cursor CLI is in PATH). On macOS, enable "Shell Command: Install 'cursor' command in PATH" in Cursor (Command Palette → "Shell Command") so `cursor` is available in the terminal.

## Agent Skills

Agent skills (Cursor, Antigravity, etc.) live in **`dotfiles/.agent/skills/`**. The install script symlinks this directory to `~/.cursor/skills` and `~/.gemini/antigravity/skills`, so the same skills are available in both tools. Add skills as subdirectories with a `SKILL.md` in each (see Cursor’s create-skill format). Skills may be grouped in category folders (e.g. `react/`, `frontend/`, `workflow/`). To support another tool later, add a `create_symlink` in `install.sh` pointing to the same `dotfiles/.agent/skills` source.

**Adding a skill from GitHub:** From the repo root, pass the GitHub "tree" URL for the skill directory. The skill name defaults to the last path segment; you can override it with a second argument:

```bash
./scripts/add-skill-from-github.sh "https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
# → adds dotfiles/.agent/skills/react-best-practices

./scripts/add-skill-from-github.sh "https://github.com/anthropics/skills/tree/main/skills/webapp-testing" my-name
# → adds dotfiles/.agent/skills/my-name
```

The script uses a sparse checkout to fetch only that directory. Run it again with the same URL to update from upstream.

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
| `dotfiles/.cursor/mcp.json.template` | Cursor MCP server config template (API keys substituted at install) |
| `dotfiles/.config/Cursor/User/settings.json` | Cursor editor settings |
| `dotfiles/.config/Cursor/extensions.txt` | List of Cursor extension IDs (one per line) |
| `dotfiles/.agent/skills/` | Agent skills (symlinked to Cursor and Antigravity) |
| `mise.toml` | Default runtimes managed by mise (e.g. Node) |
| `Brewfile` | Homebrew packages, casks, and dependencies (macOS) |
| `Brewfile.wsl` | Homebrew formulae for WSL/Linux (no casks) |
| `winget-packages.json` | Windows app list for `winget import` (Cursor, Docker, Chrome, etc.) |
| `install.sh` | Bootstrap script for new machines (macOS / WSL) |
| `install-windows.ps1` | Sync Cursor settings, MCP, extensions, skills to Windows (run from repo root in PowerShell) |
| `dotfiles/.zshrc-local.example.wsl` | Example WSL overrides for `brew_prefix` and PATH |

## Windows (WSL)

On Windows you can use WSL for the same shell/tooling and winget for GUI apps.

**In WSL:** Clone the repo (e.g. under `/mnt/c/Users/.../t-configs`). Run `./install.sh`; it detects Linux and uses `Brewfile.wsl` (formulae only, no casks) automatically.

```bash
cd /mnt/c/Users/tdsei/Code/t-configs   # or your path
./install.sh
```

If mise/Node fails with `libatomic.so.1`, install the system library then re-run: `sudo apt-get install libatomic1` then `mise install` or `./install.sh`. If you see `$'\r': command not found` when sourcing dotfiles, fix line endings: `sed -i 's/\r$//' dotfiles/.zshrc-env-vars dotfiles/.zshrc-local` (and re-copy from the `.example` files if needed).

Use **zsh** to load the config (not bash): run `zsh` then `source ~/.zshrc`. To set zsh as default on WSL, add Homebrew's zsh to allowed shells then run chsh: `echo '/home/linuxbrew/.linuxbrew/bin/zsh' | sudo tee -a /etc/shells` then `chsh -s $(which zsh)` (log out and back in). Override Mac paths in `dotfiles/.zshrc-local` (e.g. set `brew_prefix` for Linux Homebrew). Copy the WSL example: `cp dotfiles/.zshrc-local.example.wsl dotfiles/.zshrc-local` then edit.

**Cursor on Windows:** From PowerShell in the repo root, run `.\install-windows.ps1` to sync Cursor settings, MCP config, extensions, and agent skills to Windows. Set `$env:REF_API_KEY` before running if you use the Ref MCP server. Settings in the repo use Mac paths; set Python interpreter and workspace paths in Cursor once if needed.

**Windows apps (winget):** From PowerShell in the repo root:

```powershell
winget import -i winget-packages.json --accept-package-agreements
# or
.\scripts\install-winget.ps1
```

Includes Cursor, Docker Desktop, Google Chrome, PowerToys, Windows Terminal. Fira Code is not in winget — install manually from [Fira Code releases](https://github.com/tonsky/FiraCode/releases) if you use it.

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
