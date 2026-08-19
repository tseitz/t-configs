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
6. Install Claude Code plugins from `dotfiles/.claude/plugins/installed_plugins.json`
7. Create `.zshrc-env-vars` (private secrets) and `.zshrc-local` (machine-specific overrides) from example templates

### On a machine that's already set up

Use `--check` and `--sync` instead of a bare `./install.sh`:

```bash
./install.sh --check   # report drift, change nothing
./install.sh --sync    # non-interactive, add-only: create what's missing
```

`--check` audits every symlink, lists dangling links and stale `.bak` files, diffs the installed Claude plugins against `dotfiles/.claude/plugins/installed_plugins.json`, and runs `brew bundle check`.

`--sync` runs every step non-interactively but refuses the single destructive branch in `create_symlink`: where a real file — or a link to somewhere else — already occupies a destination, it reports the drift and leaves it alone rather than moving it to `.bak`. So `--sync` can only ever add. Run a bare `./install.sh` when you actually want the repo copy to take over a destination that has local content; that path backs the original up first, to a `.bak` name that doesn't already exist.

Other flags: `--yes` (non-interactive, destructive branch enabled), `--dry-run` (list steps only), `--verbose` (also print already-correct symlinks, which are otherwise summarised as a count).

`create_symlink` skips any source that isn't present in the repo, so link lines for files you haven't added yet are inert rather than producing dangling symlinks — add the file and the link starts working with no script edit.

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

## Editor Settings

`dotfiles/.config/editors/settings.json` holds the VS Code User settings and is symlinked into place. To pull your current settings into the repo:

- **macOS:**
  `cp ~/Library/Application\ Support/Code/User/settings.json ~/t-configs/dotfiles/.config/editors/settings.json`
- **Linux:**
  `cp ~/.config/Code/User/settings.json ~/t-configs/dotfiles/.config/editors/settings.json`

The file sits under `.config/editors/` rather than `.config/Code/` so a second editor can share the same source without moving it — add one `create_symlink` line in `install.sh` pointing at it.

## Agent Skills

Agent skills live in **`dotfiles/.claude/skills/`**, symlinked to `~/.claude/skills`. Add skills as subdirectories with a `SKILL.md` in each. Skills may be grouped in category folders (e.g. `react/`, `frontend/`, `workflow/`). To share them with another tool later, add a `create_symlink` in `install.sh` pointing to the same source.

**Adding a skill from GitHub:** From the repo root, pass the GitHub "tree" URL for the skill directory. The skill name defaults to the last path segment; you can override it with a second argument:

```bash
./scripts/add-skill-from-github.sh "https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
# → adds dotfiles/.claude/skills/react-best-practices

./scripts/add-skill-from-github.sh "https://github.com/anthropics/skills/tree/main/skills/webapp-testing" my-name
# → adds dotfiles/.claude/skills/my-name
```

The script uses a sparse checkout to fetch only that directory. Run it again with the same URL to update from upstream.

## What's Included

| File | Description |
|------|-------------|
| `dotfiles/.zshrc` | Zsh configuration — aliases, functions, PATH, tool init |
| `dotfiles/.zshenv` | Zsh environment — Homebrew PATH, Cargo/Rust |
| `dotfiles/.zshrc-env-vars.example` | Template for private environment variables |
| `dotfiles/.zshrc-local.example` | Template for machine-specific overrides |
| `dotfiles/.gitconfig` | Git configuration — user, LFS, default branch, pull strategy, SSH URL rewrites |
| `dotfiles/.gitconfig-work.example` | Template for the work commit identity. `install.sh` copies it to `dotfiles/.gitconfig-work`, which is **gitignored** (this repo is public) and pulled in by `.gitconfig`'s `includeIf` for repos under `~/Code/presentation/`. Not symlinked — referenced by repo path. Fill in the real email after install: git ignores a missing include silently, so a placeholder means work commits get the personal email. |
| `dotfiles/.zprofile` | Login-shell PATH (Docker Desktop CLI) |
| `dotfiles/.hushlogin` | Suppresses macOS "Last login" terminal banner |
| `dotfiles/.config/nvim/` | Neovim configuration (LazyVim) |
| `dotfiles/.config/editors/settings.json` | VS Code User settings |
| `dotfiles/.claude/` | Claude Code config — skills, rules, agents, commands, scripts, output styles, `CLAUDE.md` |
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
