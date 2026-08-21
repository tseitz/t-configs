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
  rules,agents,commands,scripts,output-styles}` (and `AGENTS.md`, `README.md`,
  `statusline-command.sh`), are symlinks into `~/t-configs/dotfiles/.claude/`. When I say "update my personal
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
- When in doubt about whether something syncs, check if the target is a symlink
  (`ls -l`) before editing.
