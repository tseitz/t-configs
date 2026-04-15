---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript/JavaScript Testing

> This file extends [common/testing.md](../common/testing.md) with TypeScript/JavaScript specific content.

## Frameworks

- **Unit / Integration**: Vitest (`pnpm test`, `pnpm test:coverage`)
- **E2E**: Playwright (`pnpm playwright test`)

## Agent Support

- **tdd-guide** — TDD workflow enforcement, proactively triggered
- **e2e-runner** — Playwright E2E testing specialist

## Reference

See skill: `tdd-workflow` for detailed vitest patterns, mocking with `vi.mock`, and git checkpoints.
See skill: `e2e-testing` for Playwright POM patterns, flaky test strategies, and CI/CD integration.
