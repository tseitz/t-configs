---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring TypeScript code. Enforces test-driven development with 80%+ coverage including unit, integration, and E2E tests.
---

# Test-Driven Development Workflow (TypeScript / Vitest)

## When to Activate

- Writing new features or functionality
- Fixing bugs
- Refactoring existing code
- Adding API endpoints
- Creating new components

---

## Core Principles

1. **Tests BEFORE code** — always write the test first
2. **80%+ coverage** — unit + integration + E2E combined
3. **All edge cases covered** — error paths, boundaries, nulls
4. **Git checkpoints** — commit after each TDD stage on the active branch

---

## TDD Cycle

### Step 1 — Write User Journey

```
As a [role], I want to [action], so that [benefit]
```

### Step 2 — Write Failing Test (RED)

Write a test that describes the expected behavior. It must fail for the right reason — missing implementation, not a broken test setup.

```typescript
import { describe, it, expect } from 'vitest'
import { createUser } from './userService'

describe('createUser', () => {
  it('returns the created user with hashed password', async () => {
    const result = await createUser({ email: 'a@b.com', password: 'secret' })
    expect(result.email).toBe('a@b.com')
    expect(result.password).not.toBe('secret') // should be hashed
  })

  it('throws when email already exists', async () => {
    await createUser({ email: 'a@b.com', password: 'secret' })
    await expect(createUser({ email: 'a@b.com', password: 'other' }))
      .rejects.toThrow('Email already in use')
  })
})
```

Run and verify failure:
```bash
pnpm test -- --reporter=verbose createUser
```

RED gate: the test must compile, execute, and fail for the intended reason. A test that was only written but not run does not count as RED.

**Git checkpoint:**
```
test: add reproducer for <feature or bug>
```

### Step 3 — Implement Minimally (GREEN)

Write the smallest amount of code that makes the test pass. No more.

Run and verify pass:
```bash
pnpm test -- createUser
```

**Git checkpoint:**
```
fix: <feature or bug>
```

### Step 4 — Refactor (IMPROVE)

Improve code quality while keeping tests green: remove duplication, improve naming, optimize.

```bash
pnpm test -- createUser
# All tests must still pass
```

**Git checkpoint (optional):**
```
refactor: clean up <feature or bug> implementation
```

### Step 5 — Verify Coverage

```bash
pnpm test:coverage
# Target: 80%+ branches, functions, lines, statements
```

---

## Test Types

### Unit Tests — individual functions in isolation

```typescript
import { describe, it, expect } from 'vitest'

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('handles negative amounts', () => {
    expect(formatCurrency(-50)).toBe('-$50.00')
  })
})
```

### Integration Tests — API endpoints and database operations

```typescript
describe('POST /api/users', () => {
  it('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'a@b.com', password: 'secret' })

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('a@b.com')
  })

  it('returns 409 for duplicate email', async () => {
    await createUser({ email: 'a@b.com', password: 'secret' })

    const res = await request(app)
      .post('/api/users')
      .send({ email: 'a@b.com', password: 'other' })

    expect(res.status).toBe(409)
  })
})
```

### E2E Tests — critical user flows (Playwright)

```typescript
test('user can sign up and see dashboard', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('input[name="email"]', 'user@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('h1')).toContainText('Welcome')
})
```

---

## Edge Cases to Always Test

1. **Null / undefined** input
2. **Empty** arrays, strings, objects
3. **Invalid types** passed to functions
4. **Boundary values** (0, -1, MAX_INT, empty string)
5. **Error paths** (network failures, DB errors, timeouts)
6. **Concurrent operations** (race conditions where relevant)

---

## Mocking External Dependencies

Mock at the boundary — external services, databases, APIs. Do not mock internal application code.

```typescript
import { vi } from 'vitest'

// Mock a database module
vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] }),
}))

// Mock a cache module
vi.mock('@/lib/cache', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
}))

// Mock an external API client
vi.mock('@/lib/externalApi', () => ({
  fetchData: vi.fn().mockResolvedValue({ result: 'mocked' }),
}))
```

---

## Test File Organization

```
src/
├── services/
│   ├── userService.ts
│   └── userService.test.ts       # Unit tests adjacent to source
├── routes/
│   └── users/
│       ├── route.ts
│       └── route.test.ts         # Integration tests
└── e2e/
    └── auth.spec.ts              # E2E tests
```

---

## Coverage Thresholds (vitest.config.ts)

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
```

Higher bar (100%) for: financial calculations, authentication logic, security-critical code.

---

## Anti-Patterns to Avoid

| Wrong | Right |
|-------|-------|
| Test internal state (`component.state.count`) | Test user-visible behavior (`screen.getByText('5')`) |
| Tests that depend on each other | Each test sets up its own data |
| Broad `catch` that hides errors | Assert on specific error types/messages |
| Mocking internal application code | Only mock external boundaries |
| Writing tests after implementation | Always RED first |

---

## Git Checkpoint Rules

- Count only commits on the **current active branch** for the current task
- Verify each checkpoint is reachable from `HEAD` before continuing
- Do not squash checkpoint commits until the TDD cycle is complete
- Preferred compact form: one RED commit + one GREEN commit + one optional REFACTOR commit
