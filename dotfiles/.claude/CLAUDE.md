# Global Instructions

## Git safety

NEVER force push (`git push --force`, `--force-with-lease`, or `-f`) without asking
me first. Present the branch and the reason, and wait for my explicit confirmation
before running it — even on a branch I own.

## Clickable file references

When citing a file location as a clickable link (`path:line`), always use the
**absolute path** (e.g. `/Users/tseitz/Code/.../FlexibleReports.test.tsx:188`),
never a repo-relative one. Absolute paths resolve unambiguously in the IDE even
when the cwd is a git worktree that isn't an open workspace root folder.

## Working with t-configs (my dotfiles repo)

My global Claude config is version-controlled in `~/t-configs` and shared across my
work and personal machines. Understand how it syncs before editing anything under
`~/.claude/`:

- **Symlinked → editing = editing the repo.** This file, plus `~/.claude/{skills,
  rules,agents,commands,scripts,output-styles}` and `statusline-command.sh`, are
  symlinks into `~/t-configs/dotfiles/.claude/`. (`install.sh` also has call sites for
  `AGENTS.md`, `README.md`, `hooks/` and a few plugin files that aren't in the repo; it
  skips them by design, so re-adding the file revives the link.) When I say "update my personal
  claude", "update my global rules/instructions", "add a command/agent/skill", etc.,
  just edit the file in place — the change lands in the repo automatically. Then commit
  and push so my other machine picks it up on `git pull`.
- **`settings.json` is NOT symlinked** — it's seeded once from `settings.base.json`,
  then owned by this machine (Claude Code rewrites it atomically; a symlink would break
  that). So:
  - Change that should be **shared across machines** → edit
    `~/t-configs/dotfiles/.claude/settings.base.json`.
  - **This-machine-only** tweak → edit `~/.claude/settings.json` (or
    `~/.claude/settings.local.json` for account-specific overrides).
  - Never assume editing `~/.claude/settings.json` syncs — it does not.
- **Editing `settings.base.json` does NOT reach a machine that is already set up.**
  `install.sh` seeds it once and then leaves it alone forever, by design. A `SessionStart`
  hook (`scripts/settings-drift.js`) closes that gap: it warns when the base has entries
  this machine lacks in the **additive allow-lists** — `sandbox.excludedCommands`,
  `sandbox.network.allowedDomains`, `sandbox.network.allowUnixSockets`,
  `sandbox.filesystem.allowWrite`, `permissions.allow`. Run `./install.sh --sync-lists`
  to append them, or `./install.sh --check` to see the report on demand.
  - Only those lists are compared. Everything else (plugins, hooks, output style) differs
    between machines on purpose, so diffing whole files is pure noise.
  - The check is **one-directional**: base → machine. Something you add locally still has
    to be copied into `settings.base.json` by hand to reach your other machine.
  - `dotfiles/.claude/settings.json` is a gitignored local snapshot written by two hooks.
    It is a backup, **not** a sync path — it never leaves the machine.
- **Work-only config lives in `settings.work.json`, gated on a marker.** Work plugins
  (Atlassian, the `presentation-skills` and `inmarket-skills` sets) and their marketplaces
  are in `~/t-configs/dotfiles/.claude/settings.work.json`, which applies **only** on a
  machine carrying `dotfiles/.work-machine`. Create the marker with `./install.sh --work`
  once; it is sticky and gitignored. The base is then merged with the work overlay at seed
  time, and `settings-drift.js` reads both, so a work plugin is not drift on a work machine
  and not wanted on a personal one.
  - Work-ness is **not** inferred from `.gitconfig-work`. `install.sh` seeds that file with a
    placeholder email in the same step that seeds `settings.json`, so at first-install time
    it always looks personal. The explicit marker exists to dodge that ordering trap.
  - Put something in the work file only if it is genuinely work-only. Widening it past
    plugins and marketplaces turns it into a second baseline that has to be kept in step.
- **`enabledPlugins` in `settings.base.json` is the plugin wanted list.** `install.sh` step 9
  installs every key set to `true` (plus the work overlay's keys on a work machine); `false`
  is a recorded "tried it, don't want it". `plugins/installed_plugins.json` is Claude Code's
  runtime state — gitignored, never seeded, never a wanted list. It held absolute install
  paths and git SHAs, so copying one machine's copy to another wrote paths that were true
  somewhere else, and because it was gitignored a fresh clone never had it at all.
  `settings-drift.js` compares plugin **keys** but never their values, so a plugin toggled
  off here on purpose is not switched back on by a sync.
- **There are TWO work/personal axes, and picking the wrong one is the usual mistake.**
  `.work-machine` above is the *machine* axis: it answers "what does this machine have
  installed" (plugins, packages, credentials), which cannot be directory-scoped. The
  *directory* axis is `T_WORK`, exported by a `chpwd` hook in `dotfiles/.zshrc` whenever
  `$PWD` is under `T_WORK_ROOT` (`~/Code/presentation`): it answers "how should a tool
  behave in this project". This machine is both work and personal — it carries the marker
  *and* is where t-configs itself is edited — so a machine-level switch would leak work
  config into personal work.
  - **Reach for the tool's own directory mechanism first.** `.gitconfig`'s `includeIf`,
    VS Code folder settings and per-repo `mise.toml` already do this properly. `T_WORK`
    exists for tools that have *no* such mechanism — starship is the only current consumer,
    because it supports neither includes nor conditionals, only `detect_env_vars`.
  - **Gate on presence, never on value.** `detect_env_vars = ["T_WORK"]` hides a module
    when the variable is absent, so "personal" must mean *unset*. Setting `T_WORK=0` would
    read as work.
  - `T_WORK_ROOT` in `.zshrc` and the `includeIf` path in `.gitconfig` are the same fact in
    two files. `./install.sh --check` asserts they agree, because otherwise moving the work
    root would silently break the prompt *and* send work commits from the personal email.
    `T_WORK_FORCE=1` is the escape hatch for a work clone outside the root.
- When in doubt about whether something syncs, check if the target is a symlink
  (`ls -l`) before editing.
