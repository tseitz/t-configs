---
description: Security and quality review of local uncommitted changes — run before committing or pushing
argument-hint: (no arguments)
---

# Code Review

Comprehensive review of uncommitted local changes before commit or push.

---

## Phase 1 — GATHER

```bash
git diff --name-only HEAD
```

If no changed files, stop: "Nothing to review."

---

## Phase 2 — REVIEW

Read each changed file in full. The standards live in `rules/common/coding-style.md` and
`development-workflow.md` §5 — apply them, don't restate them here.

If the diff touches auth, user input, database queries, the file system, external API calls,
crypto, or payments, hand it to the **security-reviewer** agent as well.

---

## Phase 3 — REPORT

For each finding: **file:line** (absolute path), what's wrong, and the suggested fix. Use the one
severity scale:

| Severity | Meaning | Action |
|---|---|---|
| **blocking** | a secret in the diff, an injection or auth bypass, data loss, an error swallowed so a real failure goes silent | **stop the commit** |
| **should-fix** | a bug or a real maintainability cost, but nothing dangerous ships | warn, author decides |
| **nit** | style or preference | note it once, don't push |

Name the concrete consequence for each finding. If you can't, it's a nit or it's nothing.

> For reviewing a GitHub PR, use `/pr-review-toolkit:review-pr` instead.
