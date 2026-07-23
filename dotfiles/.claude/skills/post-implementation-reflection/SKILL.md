---
name: post-implementation-reflection
description: After a plan or large task is implemented, reflects on changes made, pain points, and improvements; then identifies and implements cleanup or refactors. Use when the user asks to reflect on implementation, do a post-plan retrospective, clean up after a large task, or when a plan or multi-step implementation has just been completed.
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

Before reflecting, get accurate context — don't rely on working memory alone:

- Run `git log --oneline -10` to confirm what commits landed
- Run `git diff HEAD~N` (where N = number of commits in the feature) to see the actual diff
- Check for a session state doc (HANDOFF.md, CONTEXT.md, or equivalent) and read it
- Read `.claude/sandbox-friction.jsonl` if present — the capture hook logs sandbox blocks that hit
  during the work but are gone from working memory. These feed the Agent QoL lens.
- Skim the key changed files — reflection is only as good as what you actually re-read

### 1. Summarize What Changed

One short paragraph or bullet list: what was implemented, where it lives, any deviations from the
original plan and why.

### 2. Reflect Through These Lenses

Every finding **must cite a `file:line`** (or a specific function/pattern). A lens with no citation
is not a finding — write "nothing to flag" and move on. This is a forcing function: the same model
that wrote the code is grading it, so "looks fine" is the default failure mode, not a result.

**Counter author bias on large changes.** If the diff spans many files or the logic is subtle,
dispatch a **fresh-context subagent** (`Explore` or `code-reviewer`) to do the reflection instead of
self-reviewing — give it the diff and these lenses, and have it return findings with citations. For
small, self-contained changes, inline self-review is fine.

For each lens, be concrete. Skip any lens that doesn't apply.

**Simplicity**
- Does each function do one thing? Are there any that do two or three?
- Is there logic that could be a well-named helper instead of an inline block?
- Any unnecessary abstraction or over-engineering added during implementation?

**Elegance**
- Are there awkward workarounds, defensive checks for things that can't happen, or temporary
  scaffolding that wasn't removed?
- Would a fresh reader find this implementation surprising, or does it feel like the obvious way?
- Any naming that obscures intent (variables, functions, files)?

**Agent navigability** ← most important for this project
- Can the next agent session find every relevant piece of this feature in one read of the relevant
  file(s)?
- Are there non-obvious decisions that lack a comment explaining *why* (not *what*)?
- Does the code reference the right project primitives and utilize project conventions?

**Agent Quality of Life**
- Did any tool call fail unexpectedly? What did you do instead, and what would the right path have looked like?
- Were any make/pnpm/npm/script targets missing that would have been useful? What would you have named them?
- Did sandbox restrictions block you? Check `.claude/sandbox-friction.jsonl` and your own memory of
  the session. For anything worth a durable fix, **delegate to the `sandbox-friction` skill** to
  diagnose the layer and propose the correctly-schemaed settings.json change — don't hand-write
  sandbox config from here.
- Was anything in CLAUDE.md (or equivalent) **wrong** (actively misleading to a future agent)? Flag these first — they're the most dangerous. Then note any plain gaps.
- Did you read 3+ files to answer something that should have had one authoritative source? What would that source look like?
- Were there any repeated lookups — files, functions, patterns — that suggest a missing convention or shortcut?
- Did you make any judgment calls without clear guidance that could silently go wrong next session? Name the decision and what you assumed.
- Anything in the dev environment (server startup, test runner, type-check) that felt unnecessarily slow or fragile? Did a flaky or intermittent failure eat time — what was the symptom?

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
- Run the project's validation gate to confirm no regressions (see Close the Loop)

### 6. Close the Loop

This step is project-specific. Check **CLAUDE.md** (or the project's equivalent conventions file)
and your **memory / lessons system** for the right commands and documents. Typical things to do:

- **Run the validation gate** — CLAUDE.md usually names this (e.g. `make precommit`, `pnpm check`,
  `./scripts/validate.sh`). This is the one place to run it; don't claim "done" without its output
  (see `verification-before-completion`).
- **Update session state** — if the project uses a HANDOFF.md, CONTEXT.md, or similar doc, overwrite
  it to reflect the current state of the codebase. The next agent session starts cold.
- **Capture learnings via existing tooling, don't hand-roll it.** The Agent QoL findings above are
  the raw material. Route them: durable cross-project patterns → `/learn` or `lessons-to-skills`;
  wrong/misleading CLAUDE.md lines → `claude-md-improver`; project facts not derivable from code →
  memory. Only write a freeform `.claude/lessons/` note if the project has no such system.
- **Flag if docs need updating** — README, architecture docs, or API docs that are now stale.

If you're unsure where these live, check CLAUDE.md first, then your memory files.

---

## Output Format

```
### What changed
[1–5 bullets]

### Reflection
**Simplicity:** [finding or "nothing to flag"]
**Elegance:** [finding or "nothing to flag"]
**Agent navigability:** [finding or "nothing to flag"]
**Agent QoL:** [friction points, missing scripts, env issues, or "nothing to flag"]
**Technical debt:** [finding or "nothing to flag"]

### Follow-up
Must: ...
Should: ...
Nice to have: ...
```

Then **stop for approval** (step 4). Once approved, implement in separate commits, then close the
loop: run the validation gate, update session state, route learnings to the right tooling.
