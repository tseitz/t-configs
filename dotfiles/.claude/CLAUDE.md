# Global Instructions

## Git safety

NEVER force push (`git push --force`, `--force-with-lease`, or `-f`) without asking
me first. Present the branch and the reason, and wait for my explicit confirmation
before running it — even on a branch I own.

A plain `git push` needs no approval. On personal repos, push after every commit; on work
repos, push feature branches freely.

## Anything that notifies people — ask first

A push is silent; these are not. Get my explicit OK before any of them:

- opening a PR that isn't a draft — always `gh pr create --draft`; never mark one ready for review
- requesting reviewers, assigning anyone, or @-mentioning someone
- posting a PR or issue comment, review or reply
- sending anything on my behalf: Slack, email, Jira or Notion comments, calendar invites

Drafting the text for me to send is always fine.

## Friction log

Maintain `~/code/friction.md`, one global log shared by all my Claude sessions, of anything
that cost real time: a tool that failed mysteriously, a workaround, a wrong turn from a stale
doc. When you lose time to one mid-session, append one line: `date · symptom · fix · project`.
Check this file first when tooling fails in a way that looks environmental. Append only what
slowed work and would recur; don't log one-off typos. Never put secrets in it.

## Tooling traps

- **The Bash tool runs zsh, not bash.** Unquoted `$var` is not word-split (`set -- $p` passes
  one arg), unmatched globs error (`no matches found`), and a word starting `=` expands as a
  command path. Pass args explicitly, quote globs, or wrap the snippet in `bash -c`.
  `$var:x` applies a history modifier (`$R:rspack.js` → `$R:r` + `spack.js`), so write `${R}:path`.
- **mise runs in paranoid mode: trust is tied to file content.** Re-trust after editing
  `mise.toml` or switching to a branch that changes it. `mise trust` takes one path per call
  and version files (`Gemfile`, `.ruby-version`) count, so loop:
  `for f in mise.toml Gemfile .ruby-version; do mise trust "$PWD/$f"; done`. Not `--all`: it
  also trusts parent dirs.
- **Docker build fails with `additional privileges requested: --allow=fs.read=…`** (Compose
  bake entitlements). Prefix that one command with `BUILDX_BAKE_ENTITLEMENTS_FS=0`;
  `COMPOSE_BAKE=false` no longer helps. Don't export it globally.
- **`gh api pulls/comments/{id}` 404s for a comment in a pending review.** Read it through
  `pulls/N/reviews/{review_id}/comments`; edit it with GraphQL `updatePullRequestReviewComment`.
- **CircleCI goes through the `circleci` CLI** (already authenticated; project comes from the git
  remote): `circleci run list -B` → `run get <id>` → `job output get <job> --step-num N --condensed`.
- **Jira reads go through `acli` first** (`jira-with-acli` skill). The Atlassian MCP can hang
  for many minutes with no response; use it only for what `acli` can't do.

## Clickable file references

When citing a file location as a clickable link (`path:line`), always use the
**absolute path** (e.g. `/Users/tseitz/Code/.../FlexibleReports.test.tsx:188`),
never a repo-relative one. Absolute paths resolve unambiguously in the IDE even
when the cwd is a git worktree that isn't an open workspace root folder.

## Working with t-configs (my dotfiles repo)

My global Claude config is version-controlled in `~/t-configs` and shared across my
work and personal machines.

- **Symlinked → editing = editing the repo.** This file, plus `~/.claude/{rules,
  agents,commands,scripts,output-styles}` and `statusline-command.sh`, are
  symlinks into `~/t-configs/dotfiles/.claude/`. Skills are the exception: they live in
  `~/t-configs/dotfiles/.agents/skills/` (linked per skill into `~/.claude/skills`). When I say "update my personal
  claude", "update my global rules/instructions", "add a command/agent/skill", etc.,
  just edit the file in place — the change lands in the repo automatically. Then commit
  and push so my other machine picks it up on `git pull`.
- **`settings.json` is NOT symlinked and does NOT sync.** Shared change → edit
  `~/t-configs/dotfiles/.claude/settings.base.json`. This-machine-only → `~/.claude/settings.json`.
- **Read `~/t-configs/CLAUDE.md` before any other config change.** It covers seeding, drift
  checks, the work overlay, and the work/personal axes.
