# Testing Requirements

## Minimum Test Coverage: 80%

Test Types (ALL required):
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (Playwright)

## Test-Driven Development

MANDATORY workflow:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)

## Agents

| Agent | When to Use |
|-------|-------------|
| **tdd-guide** | Use PROACTIVELY on new features and bug fixes — enforces write-tests-first |
| **e2e-runner** | Use PROACTIVELY for E2E test creation and maintenance |

## Skills (detailed patterns by stack)

| Skill | When to Use |
|-------|-------------|
| `tdd-workflow` | TypeScript/Vitest TDD cycle, `vi.mock`, vitest config, git checkpoints |
| `e2e-testing` | Playwright patterns, POM, flaky test handling, CI/CD integration |
| `python-testing` | pytest fixtures, parametrize, mocking, async, conftest patterns |
| `golang-testing` | Table-driven tests, subtests, benchmarks, fuzzing, httptest |
| `rust-testing` | `#[cfg(test)]`, rstest, proptest, mockall, cargo-llvm-cov |
| `ai-regression-testing` | AI-assisted dev: regression-first strategy, mock/prod parity tests |

## Coverage Command Reference

| Stack | Command |
|-------|---------|
| TypeScript (pnpm) | `pnpm test:coverage` |
| Python | `pytest --cov=src --cov-report=term-missing` |
| Go | `go test -coverprofile=coverage.out ./...` |
| Rust | `cargo llvm-cov` |
