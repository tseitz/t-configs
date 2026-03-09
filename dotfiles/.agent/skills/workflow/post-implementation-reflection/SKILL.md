---
name: post-implementation-reflection
description: After a plan or large task is implemented, reflects on changes made, pain points, and improvements; then identifies and implements cleanup or refactors. Use when the user asks to reflect on implementation, do a post-plan retrospective, clean up after a large task, or when a plan or multi-step implementation has just been completed.
memory: user
---

# Post-Implementation Reflection

Run this workflow **after** a plan or large task has been implemented. Reflect on what was done, capture pain points and improvements, then implement the follow-up changes.

## When to Use

- User explicitly asks to "reflect on the implementation," "retrospective," or "clean up after the plan"
- A multi-step plan or large task was just completed and no reflection has been done yet
- User says the implementation is done and wants improvements or cleanup

Do **not** use mid-implementation or before the main work is finished.

## Workflow

### 1. Summarize What Changed

- List the files and areas that were modified
- Briefly state what was implemented vs. the original plan (gaps, additions, simplifications)
- Note any deviations from the plan and why

### 2. Reflection (structured)

Produce a short reflection that includes:

| Section | What to capture |
|--------|------------------|
| **Pain points** | Friction during implementation: unclear specs, missing context, awkward APIs, repetitive work, confusing structure |
| **Do differently** | If redoing from scratch: different approach, order of steps, or design choices |
| **Improvements** | Quick wins: naming, comments, error messages, logging, types, tests |
| **Cleanup / refactor** | Technical debt: duplication, dead code, inconsistent patterns, unclear boundaries, missing abstractions |

Be concrete: reference specific files, functions, or patterns. Avoid generic advice.

### 3. Prioritize Follow-Up Work

From the reflection, list **actionable** items:

- **Must do**: Fixes, correctness, or clarity that materially affect maintainability or behavior
- **Should do**: Refactors and cleanups that are clearly worth doing now
- **Nice to have**: Optional improvements to skip if time-constrained

Limit to a small set (e.g., 3–7 items total) so the next step is feasible.

### 4. Implement the Changes

- Implement the **Must do** and **Should do** items (or a subset agreed with the user)
- Prefer small, focused edits: one logical change per commit if the user uses version control
- After editing, re-check the touched areas (tests, lint, build) and fix any regressions

### 5. Brief Close-Out

- One or two sentences on what was reflected on and what was changed
- Optionally note any remaining "Nice to have" items for later

## Output Format

Use this structure when presenting the reflection (before implementing):

```markdown
## Post-implementation reflection

### Summary of changes
- [Bullet list of what was implemented and where]

### Pain points
- [Concrete items]

### Would do differently
- [Concrete items]

### Improvements & cleanup
- [Concrete, actionable items]

### Follow-up (prioritized)
- **Must:** ...
- **Should:** ...
- **Nice to have:** ...
```

Then proceed to implement the Must/Should items (or the agreed subset).

## Tips

- **Evidence over opinion**: Point to specific code or behavior when describing pain or improvement.
- **One thing at a time**: Implement follow-up items in logical order; avoid mixing unrelated refactors in one edit.
- **Verify**: After cleanup, run relevant tests or checks so reflection doesn’t introduce regressions.
