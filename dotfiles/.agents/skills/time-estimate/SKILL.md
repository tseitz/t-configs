---
name: time-estimate
description: Estimate how long a task will take, measure how long it really took, and log both so future estimates get better. Opened by pre-implementation-review, closed by post-implementation-reflection. Invoke directly with `/time-estimate close <id>` to close an entry, or `/time-estimate` alone to see open and stale entries.
---

# Time Estimate

The point is a log of guesses next to measured actuals. A guess with no actual teaches nothing,
so closing an entry matters more than opening it.

v1 collects data only. No correction math until ~15–20 closed entries exist — then look at the
ratios by `type` and `axis` and decide what to do with them.

## Three clocks

All in minutes.

| Clock | What it is | Measured by |
|---|---|---|
| **agent** | Claude working | `turn_duration` entries in the transcript |
| **human** | the user reading, deciding, testing between turns | turn end → next typed message; a gap over 30 min is idle and dropped |
| **ship** | work repos: PR to merged, review and CI included | `gh`, backfilled after merge |

`session` = agent + human. **Estimate `session` always, and `ship` on work repos** — ship is the
number the user gives their team.

## The script

```bash
tt=~/.claude/skills/time-estimate/scripts/task-time.js
node $tt measure <since-iso> <until-iso> <session-id>...   # actuals for a window
node $tt fold personal|work                                 # current state per id + stale list
node $tt append personal|work <<'EOF'                       # add one event, JSON on stdin
{"ev":"…","id":"…"}
EOF
```

Always pass the event through a quoted heredoc (`<<'EOF'`): a slug with an apostrophe breaks a
quoted argument, and the shell must never expand anything in it. Never edit a log by hand and
never rewrite a line — the log is append-only events, and `fold` builds the current state.

## Which log

Pick by the origin org of the repo the task is in (`git remote get-url origin`). **Fail
closed:** only a positively personal origin goes to the public log.

- **personal** — origin owner is `tseitz`. `~/t-configs/dotfiles/.claude/estimates.jsonl`.
  **Synced to a public repo.** Tags and a generic slug only: no ticket key, ticket text, file
  paths or PR title. The script refuses `pr` and ship fields here.
- **work** — everything else, including no origin and unknown orgs.
  `~/t-configs/dotfiles/.claude/estimates.work.jsonl`, gitignored. Repo name and PR number go
  here.

## Open — at the end of planning

Called by `pre-implementation-review` Step 4. Take `start` as the time that skill's Step 0 began
(the timestamp of the user message that kicked it off), so scouting and planning count.

1. Run `fold` on the right log. Look at the last ~10 closed entries of the same `type`. No math — just
   a sanity check on your raw guess.
2. Give a range, not a point. **p50** = a coin flip. **p90** = 9 times in 10 it is done by then.
   A p90 under 1.5× the p50 is almost always overconfident.
3. Append:

```json
{"ev":"open","id":"<yyyy-mm-dd>-<kebab-slug>","start":"<iso>","session":"<$CLAUDE_CODE_SESSION_ID>","slug":"<generic, ≤6 words>","repo":"<name>","type":"bug|feature|refactor|config|docs|spike","tier":"SHORT|FULL|DEEP","files_est":5,"est":{"session_p50":90,"session_p90":150,"ship_p50":null,"ship_p90":null}}
```

4. Show the estimate in the handoff block, in hours or minutes.

Plan rejected or abandoned → append `{"ev":"drop","id":"…"}`.

## Touch — when a task continues in another session

Append `{"ev":"touch","id":"…","session":"<$CLAUDE_CODE_SESSION_ID>"}`. Without it, close never
reads that session and the actual comes out short.

## Close — when the work is done

Called by `post-implementation-reflection` Step 6, or `/time-estimate close <id>`.

1. `fold` → the entry's `start` and every session id (open + touches).
2. `measure <start> <now> <ids…>`. A missing transcript makes it exit non-zero — stop and tell the
   user. Never write a partial close.
3. Append:

```json
{"ev":"close","id":"…","actual":{"agent":41.2,"human":38.0,"session":79.2,"idle_dropped":1,"files":6},"ratio":0.88,"why_off":"<enum>","note":"<≤10 words, personal log only>","pr":{"repo":"<owner/name>","number":123}}  # pr: work only
```

`ratio` = actual session ÷ p50. `files` = files in the final diff. `pr` only on work entries.
`why_off`: `scope-grew | hidden-dependency | env-tooling | flaky-tests | review-rounds |
unclear-spec | overestimated | on-target | other`.

4. Tell the user: estimate vs actual, in one line.

## Ship backfill and stale report — every run

Every time this skill runs, after its main job:

- **Ship.** For each closed work entry with a `pr` and no `ship` event, check
  `gh pr view <n> -R <repo> --json mergedAt,createdAt`. Merged → find the `ready_for_review` time
  with `gh api repos/<repo>/issues/<n>/timeline --paginate --jq '.[]|select(.event=="ready_for_review")|.created_at' | tail -1`
  (`--jq` runs per page, so take the last line) and append `{"ev":"ship","id":"…","created_to_merged":<min>,"ready_to_merged":<min>}`.
  Not merged yet → leave it.
- **Stale.** `fold` lists entries open more than 3 days. Show them and ask: close or drop.

## Commit the personal log

Work log: nothing to commit. Personal log, after any append:

```bash
git -C ~/t-configs commit -m "chore(estimates): <ev> <id>" -- dotfiles/.claude/estimates.jsonl
git -C ~/t-configs push
```

Path-limited on purpose: the t-configs tree is often dirty, and this must not sweep that up.
