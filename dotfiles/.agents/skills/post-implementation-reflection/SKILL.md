---
name: post-implementation-reflection
description: After work is implemented, reflects on the changes and then polishes them — comment triage, simplification, cleanup. Scales from a quick pass on a small diff to a full retrospective on a plan; `qol` alone is a retro on the agent's tooling and steering files. Works on uncommitted changes, the last N commits, or a whole PR branch. Run it yourself with /post-implementation-reflection, or invoke it whenever a change is built and it deserves a lap before review.
memory: user
---

# Post-Implementation Reflection

If you were to do this feature again, what would you do differently? What could be improved? Refactored? Simplified? Made more elegant? Reflect on the changes made.

Run **after** a plan or large feature is implemented. The goal is a codebase that stays simple,
elegant, and easy to navigate — especially for any future agent sessions having to navigate the codebase.

## When to Use

- User asks to "reflect," "retrospective," or "clean up after the plan"
- A multi-step plan or large task just completed and no reflection has been done
- User says the implementation is done and wants improvements or cleanup

Do **not** use mid-implementation or before the main work is finished.

---

## Workflow

### 0. Ground Yourself

Before reflecting, get accurate context — don't rely on working memory alone.

**First resolve what "the changes" means.** Three cases; pick by what the user said, and say
which one you picked:

| Case | Diff |
|---|---|
| Not committed yet | `git diff HEAD` |
| Last N commits, N known | `git diff HEAD~N` |
| A branch or PR | branch-vs-base, below |

For a branch or PR, resolve the base — **never assume `main`.** Base branches genuinely vary
(`develop`, `development`, `master`), and guessing wrong silently degrades this into "uncommitted
changes only". On a stacked PR the base is the parent branch, so `gh pr view` is authoritative.

```bash
base="$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || true)"
[ -z "$base" ] && base="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
[ -z "$base" ] && base="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
[ -z "$base" ] && echo "could not resolve the base branch — ask" >&2
git fetch -q origin "$base" 2>/dev/null || true
git diff "$(git merge-base "origin/$base" HEAD)"...HEAD
```

Then:

- Run `git log --oneline -10` to confirm what commits landed
- Check for a session state doc (HANDOFF.md, CONTEXT.md, or equivalent) and read it
- Skim the key changed files — reflection is only as good as what you actually re-read
- **Agent QoL runs on the transcript, not recollection** — failed and costly calls are the first
  thing compaction drops. It lives at `~/.claude/projects/<slug>/<session-id>.jsonl`, the slug being the cwd
  with every `/` and `.` turned into `-`: the newest file for this session, or the session the
  user names. It runs to megabytes, so never read
  it raw. This ranks tool results by size and flags errors:

  ```bash
  jq -rs '
    (map(select(.type=="assistant") | .message.content | arrays | .[] | select(.type=="tool_use") | {(.id): .name}) | add) as $n
    | .[] | select(.type=="user") | .message.content | arrays | .[] | select(.type=="tool_result")
    | [(.content|tostring|length), (if .is_error then "ERROR" else "-" end), ($n[.tool_use_id] // "?"), .tool_use_id] | @tsv' \
    "$transcript" | sort -rn | head -20
  ```

  Pull a single call's input back out by its id when a row needs explaining.

### 1. Summarize What Changed

One short paragraph or bullet list: what was implemented, where it lives, any deviations from the
original plan and why.

### 1b. Pick the Depth — ceremony scales to the diff

**Lenses named in the invocation win.** `/post-implementation-reflection simplicity debt` runs
only those, inline, and skips the depth pick. Names: `comments` · `simplicity` · `qol` · `debt`.

Otherwise, state which depth you picked and why, in one line. When torn, go SHORT: an over-long lap on a
small change gets skimmed, and a skimmed lap catches nothing.

- **SHORT** — roughly under ten files, no new subsystem, no architectural decision. Run
  **Comments · Simplicity & navigability · Technical debt**. Skip the rest.
- **FULL** — a plan, a multi-session feature, a new subsystem, or anything architectural. Run
  every lens.

### 2. Reflect Through These Lenses

Every finding **must cite a `file:line`** (or a specific function/pattern). A lens with no citation
is not a finding — write "nothing to flag" and move on. This is a forcing function: the same model
that wrote the code is grading it, so "looks fine" is the default failure mode, not a result.

**Counter author bias on FULL.** Dispatch the **`code-reviewer`** agent with the diff and the
Simplicity and Technical debt lenses, and have it return findings with citations. Not `Explore` —
it locates code, it doesn't review it. Keep Comments and Agent QoL inline: both need this session's
memory, which a subagent doesn't have. SHORT self-reviews inline.

For each lens, be concrete. Skip any lens that doesn't apply.

**Comments** ← run this one first, on every depth. Skip it when the diff added no comments.

The standard lives in `rules/common/coding-style.md` — apply its routing test, don't restate it.
Judge only comments **this diff added**; leave pre-existing ones alone. No length or density rule
in this lens — just route each one, as concisely as the point allows.

**Cuts are relocated, not deleted.** Rationale that fails the test is still worth having — it just
doesn't belong in the repo.

- **Stays in the code:** an invariant a cleanup would break · a tooling or library workaround ·
  why a redundant-looking check is load-bearing · why two similar things are deliberately not
  shared.
- **Moves out:** the bug's history and impact · why this approach over the alternative · why a
  file *wasn't* changed · what was left out of scope · test-strategy choices · measurements and
  cross-repo facts.

**No PR open or about to open** — cut what fails the test and give each cut's rationale in one
line of your summary. Stop there; the rest of this lens is PR-only.

**A PR is open or about to open** — each cut becomes an inline comment on its anchor line. Keep it
tight: fragments and dropped grammar are fine if the point still lands.

**Never triage cold.** The most valuable of these explain *absences* — why an endpoint was left
alone, why an obvious refactor was declined, why a file isn't in the diff — and a diff can't show
what isn't in it. Run this in the session that did the work, or feed it that session's transcript
and the tickets/cross-repo context first. Triaged cold, it degrades into fluent diff narration — the exact noise this is
meant to prevent.

If the cuts become PR comments, **draft them, never post unasked.** When approved: push the code
cuts *first* (comments anchor to line numbers in the PR head, so posting before the trim lands
every anchor outdated), post as **one review** rather than N comments, check the line for existing
comments including your own from earlier rounds, and verify each anchor falls inside a changed
hunk or it won't attach.

**Simplicity & navigability**

One question: would the next agent session — or you, cold in a month — find this obvious?

- Does each function do one thing? Any that do two or three?
- Is there logic that would read better as a well-named helper than as an inline block?
- Any unnecessary abstraction or over-engineering added during implementation?
- Awkward workarounds, defensive checks for things that can't happen, or scaffolding left behind?
- Naming that obscures intent (variables, functions, files)?
- Can every relevant piece of this feature be found in one read of the file(s) it lives in?
- Does it use the project's existing primitives and conventions, or quietly reinvent them?
- (Comments are the Comments lens's job — don't re-raise them here.)

**Agent Quality of Life**

The environment, not the code: what would make the next session on this repo cheaper or less
wrong. Cite the transcript call or the steering-file line.

- **Steering files** — Was anything in CLAUDE.md (or equivalent) **wrong** (actively misleading to a future agent)? Flag these first — they're the most dangerous. Then plain gaps. Then **no-ops**: an instruction this session's behaviour shows changed nothing. Every session pays for it and nothing comes back. Judge only what this session touched; this is not a full config audit.
- **Checks** — Did you make a mistake a lint rule, type, test or hook could have caught? Read the repo's own check scripts and CI first: a check that exists but is unwired or silently broken is the finding, not a new one. A repo with no guardrail at all (no pre-commit hook, no CI job running lint/typecheck/test) is a finding in itself.
- **Navigation** — Did you read 3+ files to answer something that should have had one authoritative source? What would that source look like? Any repeated lookups — files, functions, patterns — that suggest a missing convention or a pointer?
- **Tool economy** — Did any tool call fail unexpectedly? What did you do instead, and what would the right path have looked like? Which calls top the transcript ranking — a response that should have been filtered or paged, an MCP tool that returns far more than you used?
- **Scripts** — Were any make/pnpm/npm/script targets missing that would have been useful? What would you have named them?
- **Information access** — Did you need something you couldn't reach: logs that weren't teed anywhere, a service with no read access, a dashboard only the user can see? Name the access that would have closed it.
- **Dev environment** — Anything (server startup, test runner, type-check) that felt unnecessarily slow or fragile? Did a flaky or intermittent failure eat time — what was the symptom?
- **Judgment calls** — Did you make any without clear guidance that could silently go wrong next session? Name the decision and what you assumed.

**Where the fix lands.** Route each finding to the first home on this list that would have
prevented it:

1. **A check** — anything mechanical: a banned API, an import shape, a file location, a fixed
   pattern. A lint rule, hook or CI job in whatever the repo already runs. Build the check rather
   than write the rule.
2. **Review-time standards** — a judgment call no check can make goes where the reviewer reads it
   (`team-pr-review`'s topics, the repo's review docs). The reviewer gets a diff and has context
   to spare; the implementer is the one under context pressure.
3. **A skill or a doc** — procedure or reference, reached through a pointer.
4. **CLAUDE.md** — last, and then as a pointer to one of the above, not the content itself.

A fix that adds a paragraph to an always-loaded file usually belongs higher up the list.

**Technical debt**
- Duplication, dead code, inconsistent patterns with the rest of the codebase
- Missing or stale tests for the new behavior
- Any tests for existing behavior that we might've touched, or boundaries we created that we need to test?
- Docs or README that need updating

### 3. Prioritize Follow-Up

From the reflection, list actionable items only — skip anything vague:

- **Must:** Correctness, clarity, or navigability issues that will cost time next session
- **Should:** Clean, clearly worth doing now
- **Nice to have:** Optional; note and move on

Keep the total to 3–7 items.

### 4. Checkpoint — Get Approval Before Editing

**Stop here.** Present the Must/Should list and wait for the user to confirm the subset to
implement. The feature is already "done"; do not start refactoring it unprompted. If the user is
absent or has pre-authorized cleanup, proceed with Must items only and note what you skipped.

### 5. Implement

- Implement only the approved items, one logical change at a time
- **Keep cleanup separate from the feature** — its own commit(s), not amended into the feature's
  history, so it stays reviewable and revertable on its own
- **Stay in scope:** do not fix unrelated pre-existing issues or start new features. Reflection
  surfaces tangents; capture them as follow-up notes, don't act on them here
- Run the project's validation gate to confirm no regressions

### 6. Close the Loop

Suggestion, not a rule: if the reflection turned up a doc (CLAUDE.md, README, architecture doc) or
a memory that's now wrong or missing, say so and offer to update it. Nothing more required.

---

## Output Format

```
### Scope
[which diff, and SHORT, FULL or the named lenses, with the one-line reason]

### What changed
[1–5 bullets]

### Reflection
[named lenses: only those lines]
**Comments:** [keep/cut/relocate per comment, or "nothing to flag"]
**Simplicity & navigability:** [finding or "nothing to flag"]
**Technical debt:** [finding or "nothing to flag"]
--- FULL only ---
**Agent QoL:** [finding → where its fix lands (check / review standard / skill or doc / CLAUDE.md pointer), or "nothing to flag"]

### Follow-up
Must: ...
Should: ...
Nice to have: ...

--- PR only ---
### Comment cuts
[rationale moved out of code, drafted as inline PR comments — NOT posted for you]
```

Then **stop for approval** (step 4). Once approved, implement in separate commits, run the
validation gate, and offer to update any doc or memory the reflection flagged.
