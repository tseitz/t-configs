---
name: receiving-pr-review
description: Walk through incoming PR review comments collaboratively. Reads each comment in context, presents it with relevant code, discusses whether to accept or push back, then implements agreed changes. Never posts comments back to GitHub — discussion happens in conversation only.
---

# Receiving a PR Review

Work through review comments as a collaborative conversation. Read each comment, understand the context, and discuss it together before making any changes. You have the final say on everything.

**Requires**: GitHub CLI (`gh`) authenticated, `uv` available.

**Important**: Never post comments, replies, or reviews back to GitHub. All discussion happens here.

## Bundled Scripts

Reuses `fetch_pr_feedback.py` from the `iterate-pr` skill:

```bash
ITERATE_PR_SKILL=$(dirname ${CLAUDE_SKILL_ROOT})/iterate-pr
uv run ${ITERATE_PR_SKILL}/scripts/fetch_pr_feedback.py [--pr NUMBER]
```

---

## Workflow

### 1. Identify the PR

```bash
gh pr view --json number,url,headRefName,baseRefName,title,author
```

If no PR is found for the current branch, stop and tell the user. If a PR number was passed as an argument, use `--pr <number>`.

### 2. Fetch All Feedback

```bash
ITERATE_PR_SKILL=$(dirname ${CLAUDE_SKILL_ROOT})/iterate-pr
uv run ${ITERATE_PR_SKILL}/scripts/fetch_pr_feedback.py
```

Silently skip:
- `resolved` threads — already handled
- `bot` comments — informational only (coverage, Dependabot, etc.)

### 3. Give a Summary First

Before diving into individual comments, give a brief triage overview:

```
PR #123 — "feat: add user settings page"

Review summary:
• 2 high-priority (must discuss)
• 3 medium-priority (should discuss)
• 4 low-priority / nits (optional — will ask)
• 1 resolved, 2 bot (skipping)

Let's start with the high-priority items.
```

### 4. Present Each Comment for Discussion

Work through comments in priority order: **high → medium → low**.

For each comment:

1. **Read the relevant file** at the path/line mentioned before presenting.
2. **Present the comment** with full context — who said it, what they said, the relevant code.
3. **Form your own assessment** — do you agree? Is the suggestion sound? Would you push back?
4. **Share your read**, then ask what the user wants to do.

**Format for each comment:**

```
─── Comment 1 of 5 (high) ───────────────────────────

@reviewer in src/features/auth/hooks/useLogin.ts:42

> "This mutation doesn't handle the loading state — if the user
>  double-clicks, it will submit twice."

Relevant code:
  const { mutate } = useMutation(loginUser);
  const handleSubmit = () => mutate(credentials);

My read: Valid catch. There's no `isPending` guard here, which
does leave a double-submit window. The fix is straightforward —
add a disabled check on the submit trigger using `isPending`.

Accept, push back, or skip?
```

### 5. Handling User Responses

**"Accept" / "yes" / "looks right":**
- Note it as agreed, move to the next comment
- Implement all agreed changes together at the end (step 7)

**"Push back" / "disagree" / "no":**
- Ask what their reasoning is, or offer your own if you have a take
- If they want to hold firm, note it as skipped — the reviewer's comment stands unaddressed
- Remind them they can explain the decision in a PR comment themselves if needed

**"Skip" / "not now" / "low priority":**
- Note it, move on

**"What do you think?" / ambiguous:**
- Give your honest assessment — agree or disagree — with one sentence of reasoning
- Then let them decide

### 6. Low-Priority Items

After high and medium are handled, present low-priority nits as a batch:

```
4 low-priority suggestions remaining:

1. [src/components/Button.tsx:12] @reviewer — "prefer const over let here"
2. [src/utils/format.ts:7] @reviewer — "nit: this could be a one-liner"
3. [src/features/auth/index.ts:3] @reviewer — "consider alphabetizing exports"
4. [src/hooks/useForm.ts:88] @reviewer — "minor: variable name could be clearer"

Which would you like to address? ("1,3", "all", "none", or pick individually)
```

### 7. Implement Agreed Changes

Once the discussion pass is complete, implement everything that was accepted:

1. List all agreed changes before touching any code:
   ```
   Implementing 3 agreed changes:
   • src/features/auth/hooks/useLogin.ts:42 — add isPending guard
   • src/utils/api.ts:15 — extract magic number to constant
   • src/components/Modal.tsx:88 — fix prop type
   ```
2. Make changes one file at a time, reading each file before editing.
3. Use the `commit` skill to commit the result.

### 8. Final Summary

After all changes are committed:

```
Done. Here's what happened:

Addressed (3):
✓ useLogin.ts — added isPending guard on submit
✓ api.ts — extracted timeout to API_TIMEOUT_MS constant
✓ Modal.tsx — corrected onClose prop type

Skipped (2):
• Button.tsx — you disagreed with the suggestion
• format.ts — nit, not worth addressing

The branch is ready to re-request review.
```

---

## Push-Back Heuristics

When forming your assessment, consider pushing back when:

- **Already fixed elsewhere** — the issue exists in the reviewer's diff view but is resolved in a later commit
- **Design decision already made** — the pattern is intentional and consistent across the codebase; the reviewer may not have seen the full picture
- **Nit on style, not correctness** — personal preference with no practical impact
- **Suggestion introduces complexity** — the "improvement" adds abstraction that isn't earned at current scale
- **Reviewer misread the code** — the concern doesn't apply given the actual runtime behavior

When pushing back, always give a concrete reason, not just disagreement.

---

## Exit Conditions

**Done:** All high/medium comments discussed and either agreed or explicitly skipped. Low-priority items presented and user has decided. Agreed changes committed.

**Stop early:** User says "that's enough" or "skip the rest." Commit anything already agreed on.

**No feedback:** If all threads are resolved or bot-only, say so and stop.

---

## Fallback (if scripts fail)

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments
gh api repos/{owner}/{repo}/issues/{number}/comments
gh pr view --json reviews,reviewDecision
```
