---
description: Stage every PR I'm personally asked to review as a tab (nvim + Claude running team-pr-review) in the herdr workspace "presentation-review"
argument-hint: "[--dry-run] [--no-review] [--prune] [PR url | owner/repo#n | repo#n ...]"
---

# Review Assigned PRs

Run the script and relay its report. It does all of the work — find, worktree, tab, Claude — and
is idempotent, so re-running only fills gaps and moves updated PRs forward.

```bash
~/.claude/scripts/review-prs.js $ARGUMENTS
```

Run it with `dangerouslyDisableSandbox: true` and `timeout: 600000`. It needs the herdr socket,
writes under `~/code/worktrees`, and reads gh's keychain token — none of which the sandbox allows —
and each new tab can take ~40s to come up.

- **No arguments** → only PRs where I'm a requested reviewer **by name**. Team-wide requests are
  counted, not staged.
- **PR arguments** → stage exactly those, e.g. a team-requested PR I'm picking up.
- **Not inside herdr** → the script exits non-zero. Say so; don't try to set the tabs up another way.

Relay the report as-is, then call out anything that needs me: `failed`/`kept`/`skipped` lines, and
notes saying Claude wasn't started or mise config was ignored. Those are deliberate: a PR that
adds a symlink, or changes (vs trunk) `.claude/`, `.mcp.json` or `CLAUDE.md`, gets no auto-started
Claude; one that changes mise config or a `.env*` file gets its mise config ignored — otherwise
that config would run as me before I've read it.

Leave cleanup to `--prune`, which only removes worktrees and tabs of **closed or merged** PRs.
Submitting a review drops me from the requested list, so "no longer requested" doesn't mean done.
