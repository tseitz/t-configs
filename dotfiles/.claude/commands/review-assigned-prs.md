---
description: Find PRs where I'm the requested reviewer, check each into an isolated worktree, and run team-pr-review on it
argument-hint: (no arguments)
---

# Review Assigned PRs

Finds every open PR where GitHub has me down as a requested reviewer, and stages each new or
updated one in its own git worktree — so none of it touches whatever I'm currently checked out
on. Ends by handing me the exact `cd` for each worktree so I can run `/team-pr-review` myself.

`team-pr-review` has `disable-model-invocation: true` — it can only run from me typing the
slash command directly, never from a script or another skill. Don't try to work around that by
replicating its steps another way; just set up the worktree and hand off.

State file: `~/Code/presentation/local/.claude-review-state.json` (gitignored scratch space —
see the `local/` dir's own gitignore note). Presentation repo roster (name → org, base branch):
`~/Code/presentation/repos.json` — its `_readme` says it's the only source of truth for "which
repos exist"; don't re-derive that list another way.

---

## Phase 1 — FIND

```bash
gh search prs --review-requested=@me --state=open \
  --json url,title,repository,number,updatedAt
```

If empty, report "no PRs assigned to you right now" and stop.

**`--review-requested=@me` over-matches.** It returns a PR if you were requested either by name
*or* because a team you belong to was requested — most of this team's PRs go out as a bulk
team ping for visibility, not a personal ask. Narrow to PRs where you personally are in the
requested-reviewers list, for each PR from the search:

```bash
gh api repos/<owner>/<repo>/pulls/<number>/requested_reviewers --jq '.users[].login'
```

Keep the PR only if `tseitz` appears in that output. A PR where you're pulled in solely via
`.teams` (not `.users`) is a team ping, not a personal assignment — drop it before Phase 2.

If nothing survives this narrowing, report "no PRs assigned to you personally right now (N
PR(s) came up via team review requests, not by name)" and stop.

---

## Phase 2 — FILTER

Read `~/Code/presentation/local/.claude-review-state.json` (an array of
`{url, updatedAt, reviewedAt}`; treat a missing file as `[]`).

Keep only PRs that are new (`url` not present) or updated since last pass (`updatedAt` from
Phase 1 is newer than the stored one). Drop the rest.

If nothing survives, report "no new PR activity to review — N PR(s) assigned, all already
reviewed at their current version" and stop.

---

## Phase 3 — RESOLVE the local repo

For each surviving PR, `repository.nameWithOwner` (`owner/name`) tells you where the clone is:

- `alight-analytics/gaia` → repo root is `~/Code/gaia` directly (it's a single repo, not a
  container of repos).
- Anything else → look up `repository.name` in `repos[].name` from
  `~/Code/presentation/repos.json`; the clone is `~/Code/presentation/<name>`.
- No match either way → skip this PR, note "no known local clone for `<nameWithOwner>`" in the
  final report. Don't guess a path.

---

## Phase 4 — REVIEW (in a worktree, one PR at a time)

In the resolved repo root:

1. Make sure `.claude/worktrees/` won't show up as untracked churn, **without touching any
   tracked file or committing anything to a shared repo**:
   ```bash
   grep -qxF '.claude/worktrees/' .git/info/exclude 2>/dev/null || echo '.claude/worktrees/' >> .git/info/exclude
   ```
2. Get the PR's head branch: `gh pr view <number> -R <nameWithOwner> --json headRefName -q .headRefName`
3. `git fetch origin -q`
4. Worktree path is `.claude/worktrees/review/pr-<number>`, branch is `review/pr-<number>` — both
   always derived from the PR number, matching the repo's normal worktree convention. If that
   path already exists (re-reviewing an updated PR), tear it down first so it rebuilds at the new
   head commit instead of reviewing a stale one:
   ```bash
   git worktree remove --force .claude/worktrees/review/pr-<number> 2>/dev/null || true
   git branch -D review/pr-<number> 2>/dev/null || true
   ```
5. Create it fresh, tracking the PR's head:
   ```bash
   git worktree add -b review/pr-<number> .claude/worktrees/review/pr-<number> "origin/<headRefName>"
   ```
6. **Skip the usual `worktree-bootstrap.sh` dependency install** — `team-pr-review` only reads
   the diff and the code, it doesn't build or run anything, so paying for `npm
   install`/`bundle install` per PR would only slow this down. If a review genuinely needs to
   run something (rare), bootstrap that one worktree by hand afterward.
7. Append `{url, updatedAt, reviewedAt: <now, ISO8601>}` to the state array (replacing any
   existing entry for that `url`) and write the file back — the worktree being staged counts as
   "reviewed" for filtering purposes even though the actual review hasn't run yet.

If checkout or worktree creation fails for one PR, note the failure and move on to the next
rather than aborting the whole batch.

Leave finished worktrees in place — they're cheap and let me dig back in before leaving GitHub
comments. Mention at the end that stale ones can be cleared with `git worktree remove` (or
`git worktree prune` for ones whose branch is already gone).

---

## Phase 5 — REPORT

One line per PR staged: repo, PR number + title, url, and the exact `cd` into its worktree, e.g.:

```
NinthDecimal/ND-Dashboard #6278 — feat(MF-0): Phase 1 — LCI Visitation campaign manager
  https://github.com/NinthDecimal/ND-Dashboard/pull/6278
  cd ~/Code/presentation/ND-Dashboard/.claude/worktrees/review/pr-6278 && claude
```

Close with: "cd into each and run `/team-pr-review:team-pr-review` yourself — that part can't be
automated."
