---
name: api-fastapi
# IMPORTANT: Keep description on ONE line for Claude Code compatibility
# prettier-ignore
description: Designs and implements REST and async APIs with FastAPI and Python using modern best practices. Use when building or refactoring APIs, designing endpoints, dependency injection, validation, or when the user asks for FastAPI, Python API, or scalable API guidance.
---

# API & FastAPI Expert

Expert at building well-structured, scalable APIs with FastAPI and Python. Apply when designing new APIs, refactoring structure, adding endpoints, or improving reliability and maintainability.

## When to Use

- Starting a new API or microservice with FastAPI
- Refactoring API layout (routers, layers, dependencies)
- Designing endpoints, request/response schemas, or error contracts
- Adding auth, validation, async DB access, or background jobs
- Improving testability, error handling, or documentation

## Project Structure

Prefer a layered layout so routes stay thin and logic is testable:

```
app/
├── main.py              # FastAPI app, lifespan, exception handlers, CORS
├── api/
│   ├── __init__.py
│   ├── deps.py          # Shared dependencies (DB session, auth, pagination)
│   └── v1/
│       ├── __init__.py
│       ├── router.py    # include_router for all v1 routes
│       ├── users.py
│       └── items.py
├── core/
│   ├── config.py        # Pydantic Settings (env, validation)
│   └── security.py     # password hashing, tokens
├── models/              # SQLAlchemy or other ORM models
├── schemas/             # Pydantic request/response models
├── services/            # Business logic (used by route handlers)
└── db/                  # session factory, base, migrations if needed
```

- **Routers**: Register under a versioned prefix, e.g. `app.include_router(api.v1.router, prefix="/api/v1")`.
- **Handlers**: Parse/validate input (Pydantic), call services, return schemas or raise HTTPException.
- **Services**: No request/response types; accept and return domain objects or primitives; easy to unit test.

## Core Patterns

### Dependencies (`api/deps.py`)

Use FastAPI’s dependency injection for DB session, auth, and shared concerns:

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

Inject `Depends(get_db)` into route handlers and services that need DB access. For auth, create a dependency that validates tokens and returns the current user (or raises 401).

### Schemas (Pydantic v2)

- Keep **request** and **response** schemas separate; use `model_config = ConfigDict(from_attributes=True)` on response schemas when building from ORM models.
- Use `Field(..., description="...")` for OpenAPI and validation messages.
- Prefer `@computed_field` or plain properties for derived response fields.

### Errors

- Use **HTTPException** for expected client errors (4xx).
- Register an **exception handler** for unhandled exceptions so responses are consistent and don’t leak internals.
- Optionally use a small **error schema** (e.g. `detail`, `code`, `request_id`) for JSON error bodies.

### Async and DB

- Prefer **async** route handlers and **async** DB (e.g. `asyncpg` + SQLAlchemy 2.0 async) for I/O-bound APIs.
- Use a single **lifespan** in `main.py` to create/teardown DB pool, caches, or background tasks.
- Avoid doing heavy CPU work in request handlers; offload to **BackgroundTasks** or a task queue (Celery, ARQ, etc.) when needed.

### Security

- **Auth**: OAuth2 password or JWT bearer in dependencies; validate and attach user to request.
- **CORS**: Configure `CORSMiddleware` explicitly (origins, methods, headers).
- **Rate limiting**: Add at reverse proxy or via middleware/dependencies for sensitive routes.

## Testing

- **Unit tests**: Test services and domain logic with mocked DB or in-memory stores.
- **Integration tests**: Use `TestClient` or `httpx.ASGITransport` against the app; use a test DB or transactions that roll back.
- **Fixtures**: Reuse app, DB session, and auth helpers so tests stay short and stable.

## Scaling and Consistency

- **Stateless** handlers and shared config (env/settings) so the app can run behind a load balancer.
- **Idempotency**: For mutating endpoints, support idempotency keys where appropriate.
- **Versioning**: Prefix routes (e.g. `/api/v1`) and keep v1 stable when introducing v2.
- **OpenAPI**: Rely on FastAPI’s generated docs; add `tags` and summaries so API contracts are clear.

## Reference

- For detailed patterns (pagination, filtering, OpenAPI customization), see [reference.md](reference.md).
