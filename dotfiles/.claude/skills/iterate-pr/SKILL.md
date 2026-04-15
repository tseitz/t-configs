---
name: iterate-pr
description: Iterate on a PR until CI passes. Use when you need to fix CI failures, address review feedback, or continuously push fixes until all checks are green. Automates the feedback-fix-push-wait cycle.
---

# Iterate on PR Until CI Passes

Continuously iterate on the current branch until all CI checks pass and review feedback is addressed.

**Requires**: GitHub CLI (`gh`) authenticated.

**Important**: All scripts must be run from the repository root directory (where `.git` is located). Use the full path to scripts via `${CLAUDE_SKILL_ROOT}`.

## Bundled Scripts

### `scripts/fetch_pr_checks.py`

Fetches CI check status and extracts failure snippets from logs.

```bash
uv run ${CLAUDE_SKILL_ROOT}/scripts/fetch_pr_checks.py [--pr NUMBER]
```

Returns JSON:
```json
{
  "pr": {"number": 123, "branch": "feat/foo"},
  "summary": {"total": 5, "passed": 3, "failed": 2, "pending": 0},
  "checks": [
    {"name": "tests", "status": "fail", "log_snippet": "...", "run_id": 123},
    {"name": "lint", "status": "pass"}
  ]
}
```

### `scripts/fetch_pr_feedback.py`

Fetches and categorizes PR review feedback by priority.

```bash
uv run ${CLAUDE_SKILL_ROOT}/scripts/fetch_pr_feedback.py [--pr NUMBER]
```

Returns JSON with feedback categorized as:
- `high` — Must address before merge (blockers, changes requested, security)
- `medium` — Should address (standard review feedback)
- `low` — Optional (nits, style, suggestions)
- `bot` — Informational automated comments (coverage reports, dependency notices)
- `resolved` — Already resolved threads

Automated review bot feedback (security scanners, linters, AI reviewers) appears in `high`/`medium`/`low` with `review_bot: true` — it is NOT placed in the `bot` bucket. Treat it the same as human feedback: verify the finding, fix real issues, skip false positives with a brief explanation.

---

## Workflow

### 1. Identify PR

```bash
gh pr view --json number,url,headRefName,baseRefName
```

Stop if no PR exists for the current branch. If the branch has diverged from base, rebase first:

```bash
git fetch origin
git rebase origin/<base-branch>
```

### 2. Gather Review Feedback

```bash
uv run ${CLAUDE_SKILL_ROOT}/scripts/fetch_pr_feedback.py
```

### 3. Handle Feedback by Priority

**Auto-fix without prompting:**
- `high` — blockers, security issues, changes requested
- `medium` — standard feedback that should be addressed

For review bot findings (`review_bot: true`): verify the finding before acting.
- Real issue → fix it
- False positive → skip, note why briefly in conversation

**Prompt user for selection:**
- `low` — present a numbered list and ask which to address:

```
Found 3 low-priority suggestions:
1. "Consider renaming this variable" — @reviewer in api.py:42
2. "Could use a list comprehension" — @reviewer in utils.py:18
3. "Add a docstring" — @reviewer in models.py:55

Which would you like to address? (e.g. "1,3" or "all" or "none")
```

**Skip silently:**
- `resolved` threads
- `bot` comments (informational only — coverage, dependency notices)

### 4. Check CI Status

```bash
uv run ${CLAUDE_SKILL_ROOT}/scripts/fetch_pr_checks.py
```

**Wait if pending:** If automated review checks are still running, wait before proceeding — they may post actionable feedback. Pure reporting tools (coverage percentage, etc.) are not worth waiting for.

### 5. Fix CI Failures

For each failing check:
1. Read the `log_snippet` to understand the actual failure — do not guess from the check name alone
2. Read the relevant source files before making changes
3. Apply minimal, targeted fixes

**Max 3 attempts on the same failure.** If it's still failing after 3 tries, stop and ask for help rather than continuing to guess.

### 6. Commit and Push

Use the `commit` skill to commit fixes, then push:

```bash
git push
```

### 7. Wait for CI

```bash
gh pr checks --watch --interval 30
```

### 8. Re-check Feedback

Automated review bots often post feedback shortly after CI completes. Wait briefly, then re-check:

```bash
sleep 10
uv run ${CLAUDE_SKILL_ROOT}/scripts/fetch_pr_feedback.py
```

If new `high` or `medium` feedback appeared, address it and return to step 6.

### 9. Repeat

Return to step 2 if CI failed or new feedback appeared.

---

## Exit Conditions

**Success:** All checks pass, no unaddressed high/medium feedback, user has decided on low-priority items.

**Ask for help:** Same failure after 3 attempts, feedback is ambiguous, infrastructure issues unrelated to the code.

**Stop:** No PR exists; branch needs rebase and conflicts require manual resolution.

---

## Fallback (if scripts fail)

```bash
gh pr checks --json name,state,conclusion,detailsUrl
gh run view <run-id> --log-failed
gh api repos/{owner}/{repo}/pulls/{number}/comments
gh pr review --list
```
