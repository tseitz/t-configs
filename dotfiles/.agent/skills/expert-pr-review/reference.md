# Reference: modern standards by domain

Use when the PR touches these areas. Keep suggestions aligned with project conventions.

## APIs (REST / HTTP)

- Resource-oriented URLs; consistent HTTP methods and status codes.
- Validation at boundaries; typed request/response; clear error payloads.
- Idempotency and safety for non-GET; versioning or compatibility strategy if needed.

## Frontend / UI

- Component boundaries and single responsibility; avoid prop drilling (composition or context as appropriate).
- Accessibility: semantics, focus, keyboard, labels; no reliance on color alone.
- State: minimal, predictable flow; avoid redundant or derived state that can be computed.

## React / component frameworks

- Components as pure where possible; side effects in designated hooks or lifecycle.
- Keys and list stability; avoid unnecessary re-renders (memoization only where measured).
- Data fetching: clear loading/error states; no fetch in render; consider Suspense/streaming where applicable.

## Backend / services

- Clear separation: handlers → application logic → data access; no business logic in frameworks or DB layer.
- Transactions and failure handling: explicit boundaries; no silent swallows; idempotency where needed.
- Concurrency: safe use of shared state; avoid race conditions and TOCTOU.

## Testing

- Tests match production behavior; avoid testing implementation details.
- Naming that describes scenario and expected outcome; one logical assertion per test where practical.
- Setup/teardown clear and minimal; no flakiness from shared mutable state or ordering.

## General

- Prefer standard library and well-maintained dependencies; avoid one-off or obsolete packages.
- Logging: structured where helpful; no secrets or PII; appropriate levels (debug vs info vs error).
- Configuration: env over hardcoding; validation at startup; documented required vars.
