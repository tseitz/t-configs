# Code Review Standards

## Purpose

Code review ensures quality, security, and maintainability before code is merged. This rule defines when and how to conduct code reviews.

## When to Review

**MANDATORY review triggers:**

- After writing or modifying code
- Before any commit to shared branches
- When security-sensitive code is changed (auth, payments, user data)
- When architectural changes are made
- Before merging pull requests

**Pre-Review Requirements:**

Before requesting review, ensure:

- All automated checks (CI/CD) are passing
- Merge conflicts are resolved
- Branch is up to date with target branch

## Review Checklist

Before marking code complete:

- [ ] Meets [coding-style.md](coding-style.md) — size limits, nesting, comment density
- [ ] No hardcoded secrets or credentials
- [ ] No leftover `console.log` or debug statements
- [ ] Tests exist for new functionality, at the bar in [testing.md](testing.md)

## Security Review Triggers

**STOP and use security-reviewer agent when:**

- Authentication or authorization code
- User input handling
- Database queries
- File system operations
- External API calls
- Cryptographic operations
- Payment or financial code

## Review Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Security vulnerability or data loss risk | **BLOCK** - Must fix before merge |
| HIGH | Bug or significant quality issue | **WARN** - Should fix before merge |
| MEDIUM | Maintainability concern | **INFO** - Consider fixing |
| LOW | Style or minor suggestion | **NOTE** - Optional |

## Personal Code Review (your own work)

**Before committing:**
```
/code-review                                    # security + quality on uncommitted changes
/test-coverage                                  # verify 80%+ coverage
commit skill                                    # runs lint/typecheck/format automatically
```

**Before creating a PR:**
```
/pr-review-toolkit:review-pr code errors        # quality + silent failures
/pr-review-toolkit:review-pr types              # if new types added
/pr-review-toolkit:review-pr comments           # if documentation added
/prp:pr                                         # create the PR
```

## External PR Review (someone else's code)

```
/pr-review-toolkit:review-pr all               # runs all specialized agents against the diff
```

Specialized agents invoked:

| Agent | Catches |
|-------|---------|
| **code-reviewer** | Style violations, bugs, CLAUDE.md compliance |
| **silent-failure-hunter** | Suppressed errors, bad fallbacks, swallowed exceptions |
| **pr-test-analyzer** | Test coverage gaps, missing edge cases |
| **comment-analyzer** | Misleading or stale comments, comment rot |
| **type-design-analyzer** | Weak type invariants, poor encapsulation (TypeScript) |

## General Agents

| Agent | Purpose |
|-------|---------|
| **security-reviewer** | Security vulnerabilities, OWASP Top 10 |
| **typescript-reviewer** | TypeScript/JavaScript specific issues |
| **python-reviewer** | Python specific issues |

## Secrets

- Never hardcode a secret. Environment variables or a secret manager, always.
- Validate that required secrets are present at startup, so a missing one fails loudly.
- **If a secret may have been exposed, say so immediately and rotate it.** Fixing the code that
  leaked it is not enough on its own.

## Approval Criteria

- **Approve**: No CRITICAL or HIGH issues
- **Warning**: Only HIGH issues (merge with caution)
- **Block**: CRITICAL issues found
