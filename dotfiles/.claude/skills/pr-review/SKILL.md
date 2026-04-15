---
name: pr-review
description: Deep PR review — high-level overview, architecture, implementation details, and specific improvement locations with file:line citations. Use when reviewing any pull request (yours or someone else's). Output is for your reference only — you post your own comments.
---

# PR Review

Review a pull request in four layers. Output is a structured review for your reference — **do not post to GitHub directly**. You decide what to share and how to phrase it.

## Setup

Fetch the PR diff and metadata first:

```bash
gh pr view <NUMBER> --json number,title,body,author,baseRefName,headRefName,additions,deletions,changedFiles
gh pr diff <NUMBER>
```

If no PR number provided, use the current branch:
```bash
gh pr view --json number,title,body,author,baseRefName,headRefName,additions,deletions,changedFiles
gh pr diff
```

Read each changed file **in full** — not just the diff hunks. Surrounding context is essential for architectural judgments.

---

## Review Structure

Work through each layer in order. Do not jump to line-level feedback before completing the overview and architecture pass.

### 1. High-level overview

- Summarize what the PR does in 2–4 sentences (goal, scope, risk area)
- Call out: new dependencies, config/env changes, breaking or behavioral changes
- Note what was **not** reviewed (out-of-scope files, no context available, etc.)

### 2. Architecture

- **Boundaries**: Module/package/layer boundaries; single responsibility; clear APIs between layers
- **Data flow**: Where data enters, how it's transformed, where it leaves; side effects and state
- **Design fit**: Consistency with existing patterns; appropriate abstraction level; no unnecessary indirection
- **Scalability and maintainability**: Coupling, testability, extension points, failure modes

### 3. Implementation details

- Correctness, edge cases, null handling, error propagation
- Naming, readability, consistency with the codebase
- Performance where relevant (N+1, allocations, unbounded loops, memory leaks)
- Security-sensitive paths (auth, input validation, sensitive data exposure)

### 4. Specific improvement locations

For each suggestion:

- **Cite exact location**: `path/to/file.ts:42–58`
- **What**: Brief description of the issue
- **Why**: Impact (correctness, maintainability, performance, security)
- **Suggestion**: One concrete recommendation — not a list of options

Avoid vague comments. If something is optional, say "Consider …" and keep it short.

---

## Output Format

```markdown
## Overview
[2–4 sentence summary — goal, scope, key risks]

## Architecture
[Boundaries, data flow, design fit, scalability/maintainability]

## Implementation
[Correctness, naming, performance, security — link to relevant code]

## Improvements
- `path/to/file:start–end` — [What]. [Why]. [Suggestion].
- `path/to/file:start–end` — [What]. [Why]. [Suggestion].
```

---

## Priorities

1. **Blocking**: Wrong behavior, security issues, broken boundaries, untestable design
2. **Important**: Maintainability, clarity, performance, consistency with project patterns
3. **Nice-to-have**: Style, minor refactors, optional improvements — label clearly, keep brief

---

## Standards to apply

- Prefer small, focused units (functions, components, modules) and explicit contracts
- Prefer immutable data and clear data flow; avoid hidden state and side effects
- Prefer dependency injection over globals and hidden singletons
- Prefer fail-fast and explicit errors over silent failures or overly broad catches
- Prefer naming and structure that reveal intent
- Align with project conventions unless suggesting a deliberate change

---

## Before finishing

- [ ] Overview reflects the full PR scope
- [ ] Architecture section addresses boundaries, data flow, and design fit
- [ ] Every suggested change includes `file:line` and a concrete suggestion
- [ ] Blocking vs important vs nice-to-have is clearly labeled
- [ ] No invented issues — only report what you verified in the diff
