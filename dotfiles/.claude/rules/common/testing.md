# Testing Requirements

## Minimum Test Coverage: 80%

Test Types (ALL required):
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (Playwright)

## Test-Driven Development

Tests first, always — the cycle itself lives in `superpowers:test-driven-development`.

## Agents

| Agent | When to Use |
|-------|-------------|
| **tdd-guide** | Use PROACTIVELY on new features and bug fixes — enforces write-tests-first |
| **e2e-runner** | Use PROACTIVELY for E2E test creation and maintenance |

## Skills

| Skill | When to Use |
|-------|-------------|
| `superpowers:test-driven-development` | The RED → GREEN → REFACTOR cycle, any language |

## Coverage Command Reference

| Stack | Command |
|-------|---------|
| TypeScript (pnpm) | `pnpm test:coverage` |
| Python | `pytest --cov=src --cov-report=term-missing` |
| Go | `go test -coverprofile=coverage.out ./...` |
| Rust | `cargo llvm-cov` |
