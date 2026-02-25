---
name: expert-pr-review
description: Expert PR reviewer using modern coding standards and best practices. Delivers high-level overview, analyzes architecture and implementation details, and cites specific improvement locations. Use when reviewing pull requests, reviewing code changes, or when the user asks for an expert or architectural code review.
---

# Expert PR Review

Review pull requests in four layers: high-level overview, architecture, implementation details, and specific improvement locations. Apply modern coding standards and best practices throughout.

## Review Structure

Conduct the review in this order. Do not skip to line-level feedback before completing the overview and architecture pass.

### 1. High-level overview

- Summarize what the PR does in 2–4 sentences (goal, scope, risk area).
- Call out: new dependencies, config/env changes, breaking or behavioral changes.
- Note what was **not** reviewed (e.g. out-of-scope, no access).

### 2. Architecture

- **Boundaries**: Module/package/layer boundaries; single responsibility; clear APIs between layers.
- **Data flow**: Where data enters, how it’s transformed, where it leaves; side effects and state.
- **Design fit**: Consistency with existing patterns; appropriate abstraction level; no unnecessary indirection.
- **Scalability and maintainability**: Coupling, testability, extension points, failure modes.

### 3. Implementation details

- Correctness, edge cases, error handling.
- Naming, readability, and consistency with the codebase.
- Performance and resource use where relevant (N+1, allocations, I/O).
- Security-sensitive paths (auth, input validation, sensitive data). For deep security review, also use the find-bugs skill.

### 4. Specific improvement locations

For each suggestion:

- **Cite exact location**: file path and line range (e.g. `src/auth/service.ts:42–58`).
- **What**: Brief description of the issue or improvement.
- **Why**: Impact (correctness, maintainability, performance, security).
- **Suggestion**: Concrete change or alternative; prefer one clear recommendation.

Avoid vague comments. If something is optional, say "Consider …" and keep it short.

## Output format

Use this structure in your response:

```markdown
## High-level overview
[2–4 sentence summary; key changes and risks]

## Architecture
[Boundaries, data flow, design fit, scalability/maintainability]

## Implementation & details
[Correctness, naming, performance, security where relevant]

## Specific improvements
[For each item:]
- **`path/to/file:start–end`** — [What]. [Why]. [Suggestion].
```

## Priorities

1. **Blocking**: Wrong behavior, security issues, broken boundaries, untestable design.
2. **Important**: Maintainability, clarity, performance, consistency with project patterns.
3. **Nice-to-have**: Style, minor refactors, optional improvements — label clearly and keep brief.

## Modern standards to apply

- Prefer small, focused units (functions, components, modules) and explicit contracts.
- Prefer immutable data and clear data flow; avoid hidden state and side effects.
- Prefer dependency injection / explicit dependencies over globals and hidden singletons.
- Prefer fail-fast and explicit errors over silent failures or overly broad catches.
- Prefer naming and structure that reveal intent; avoid "clever" or ambiguous names.
- Align with project conventions (style, patterns, testing) unless suggesting a deliberate change.

For more detailed standards by domain (e.g. API, frontend, React), see [reference.md](reference.md).

## Checklist before submitting review

- [ ] Overview written and reflects full PR scope.
- [ ] Architecture section addresses boundaries, data flow, and design fit.
- [ ] Every suggested change includes **file:line** (or range) and a concrete suggestion.
- [ ] Blocking vs important vs nice-to-have is clear.
- [ ] No invented issues; only report what you verified in the diff.
