---
name: post-implementation-reflection
description: After a plan or large task is implemented, reflects on changes made, pain points, and improvements; then identifies and implements cleanup or refactors. Use when the user asks to reflect on implementation, do a post-plan retrospective, clean up after a large task, or when a plan or multi-step implementation has just been completed.
memory: user
---

# Post-Implementation Reflection

Run **after** a plan or large feature is implemented. The goal is a codebase that stays simple,
elegant, and easy to navigate — especially for the next agent session picking up where this one
left off.

## When to Use

- User asks to "reflect," "retrospective," or "clean up after the plan"
- A multi-step plan or large task just completed and no reflection has been done
- User says the implementation is done and wants improvements or cleanup

Do **not** use mid-implementation or before the main work is finished.

---

## Workflow

### 1. Summarize What Changed

One short paragraph or bullet list: what was implemented, where it lives, any deviations from the
original plan and why.

### 2. Reflect Through These Lenses

For each lens, be concrete — reference specific files, functions, or patterns. Skip any lens that
doesn't apply.

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
- Does the code reference the right project primitives (`paths`, topology strings, driver IDs)?
  Or did new one-off patterns creep in?
- If something broke during implementation, is that gotcha now in `.claude/LESSONS.md`?

**Technical debt**
- Duplication, dead code, inconsistent patterns with the rest of the codebase
- Missing or stale tests for the new behavior
- Docs or README that need updating (check `update-readme.mdc`)

### 3. Prioritize Follow-Up

From the reflection, list actionable items only — skip anything vague:

- **Must:** Correctness, clarity, or navigability issues that will cost time next session
- **Should:** Clean, clearly worth doing now
- **Nice to have:** Optional; note and move on

Keep the total to 3–7 items.

### 4. Implement

- Implement Must and Should items (or agreed subset)
- One logical change at a time
- Run `make precommit` after edits — don't introduce regressions in cleanup

### 5. Lessons

If the reflection surfaces a non-obvious gotcha — something that bit you during implementation or
that future sessions will need to know — append it to `.claude/LESSONS.md` before closing out.

---

## Output Format

```
### What changed
[1–5 bullets]

### Reflection
**Simplicity:** [finding or "nothing to flag"]
**Elegance:** [finding or "nothing to flag"]
**Agent navigability:** [finding or "nothing to flag"]
**Technical debt:** [finding or "nothing to flag"]

### Follow-up
Must: ...
Should: ...
Nice to have: ...
```

Then implement. Then update LESSONS.md if anything is worth remembering.
