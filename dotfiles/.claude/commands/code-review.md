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

Read each changed file in full. Check for:

**Security (CRITICAL):**
- Hardcoded credentials, API keys, tokens
- SQL injection vulnerabilities
- XSS vulnerabilities
- Missing input validation
- Path traversal risks
- Insecure dependencies

**Code Quality (HIGH):**
- Functions > 50 lines
- Files > 800 lines
- Nesting depth > 4 levels
- Missing error handling
- console.log / debug statements left in
- TODO/FIXME comments

**Best Practices (MEDIUM):**
- Mutation patterns (prefer immutable)
- Missing tests for new code
- Accessibility issues (a11y) in UI code

---

## Phase 3 — REPORT

For each issue:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- File path and line number
- Description
- Suggested fix

**Block commit if any CRITICAL or HIGH issues found.**

> For reviewing a GitHub PR, use the `pr-review` skill instead.
