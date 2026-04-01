---
name: refactor-expert
description: Refactors existing code for clarity, consistency, and maintainability. Optimizes, cleans up, standardizes, and consolidates code; applies design patterns when appropriate; uses testing and verification to ensure non-breaking changes. Use when refactoring, cleaning up code, consolidating duplicates, standardizing patterns, or when the user asks for a quality refactor.
---

# Refactor Expert

Leads safe, high-quality refactors: analyze → plan → apply (with design patterns when useful) → verify. Integrates design-patterns for structure and testing/verification skills for non-breaking changes.

## Core Principles

- **Behavior first**: Refactoring does not change observable behavior. Preserve contracts and APIs unless the user explicitly asks to change them.
- **Small steps**: Prefer incremental, verifiable steps over large rewrites.
- **Evidence over claims**: Use verification-before-completion before declaring refactors done.

## Workflow

### 1. Scope and analyze

- Clarify with the user what “done” looks like (e.g. “clean up only” vs “introduce a Strategy here”).
- Identify:
  - Duplication (copy-paste, similar logic) → candidates for consolidation.
  - Inconsistencies (naming, patterns, style) → standardization targets.
  - Complexity (long functions, deep nesting, unclear flow) → simplification targets.
  - Structural/behavioral pain (creation, composition, variation) → design-pattern candidates.
- List current entry points, callers, and tests so behavior can be preserved.

### 2. Plan

- Write a short, ordered plan (can be a checklist).
- For each change: what stays the same, what is being renamed/moved/consolidated.
- If introducing a design pattern: name it and note the one place you’re applying it (use design-patterns skill to choose and cite).
- Decide verification: which tests or commands will confirm behavior is unchanged (or intentionally changed only where agreed).

### 3. Apply

- Execute the plan in small steps.
- **When improving structure or behavior**: Use the design-patterns skill. Prefer the smallest pattern that fits; introduce one pattern at a time; keep behavior unchanged.
- **When consolidating**: Extract common logic once; replace call sites; keep names and signatures consistent.
- **When standardizing**: Pick one convention (e.g. one way to create objects, one naming style) and apply it consistently.
- **When cleaning up**: Remove dead code, clarify names, reduce nesting, split long functions—without changing behavior.

### 4. Verify (required)

- **Before claiming success**: Use verification-before-completion. Run the full test suite (and any other verification commands); read output and exit code; only then state that tests pass or refactor is complete.
- If tests are missing for touched code: add or extend tests first, or note the gap and recommend adding tests before or right after the refactor.
- For security-sensitive or critical paths: consider find-bugs (or equivalent) for a quick pass on the changed surface.

## When to Use Other Skills

| Situation | Use |
|-----------|-----|
| Choosing how to structure creation, composition, or behavior | design-patterns |
| About to claim refactor complete or tests passing | verification-before-completion |
| Reviewing refactor diff for bugs or security | find-bugs |
| Adding or running tests to protect refactor | testing skills (e.g. playwright, webapp-testing as needed) |
| Duplicate or near-duplicate logic across the codebase | finding-duplicate-functions |

## Refactor Checklist (before “done”)

- [ ] Behavior preserved (or only intentionally changed where agreed).
- [ ] Duplication reduced; naming and patterns consistent where targeted.
- [ ] Design pattern (if any) applied in one focused place and cited.
- [ ] Tests (and/or build/lint) run; verification-before-completion satisfied.
- [ ] No new linter/compiler errors; no regressions in verification output.

## Anti-patterns

- **Big-bang rewrite**: Prefer small, testable steps.
- **Refactor + feature in one step**: Separate refactor from new behavior when possible.
- **Claiming success without running verification**: Always run the verification command and check output before saying “done.”
- **Over-engineering**: Use design patterns only where they clearly address a problem; avoid applying many patterns in one go.

## Summary

Refactor in small steps; use design-patterns when improving structure or behavior; use verification and testing skills to ensure non-breaking changes; never claim completion without running and checking verification evidence.
