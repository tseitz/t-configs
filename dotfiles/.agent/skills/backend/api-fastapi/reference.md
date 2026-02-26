# API & FastAPI — Reference

Optional deep-dive patterns. Use when the main SKILL.md flow is clear and you need specifics.

## Pagination

Expose `limit` and `offset` (or `cursor`) via query params. Use a shared dependency:

```python
from fastapi import Query

def pagination(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> tuple[int, int]:
    return limit, offset
```

Return a wrapper schema, e.g. `{"items": [...], "total": N, "limit": L, "offset": O}`.

## Filtering and Search

Keep query params typed with Pydantic or `Query()`. For many optional filters, use a single dependency that returns a filter object (or dict) passed into the service/repository layer. Prefer explicit param names over generic `q` when you have structured filters.

## OpenAPI

- **Tags**: Group routes with `tags=["Users"]` so docs are readable.
- **Summary/description**: Set on each route and on Pydantic models for clear contracts.
- **Examples**: Add `json_schema_extra` or `examples` on schemas for request/response samples in Swagger.

## Background Tasks

Use `BackgroundTasks` for fire-and-forget work that must complete after the response (e.g. sending an email). For long or retriable jobs, use a queue (Celery, ARQ, etc.) and return a job ID or status URL.

## Database Migrations

Prefer Alembic (or similar) with async support. Keep migrations small and reversible. Run them in CI and document how to run locally (e.g. `alembic upgrade head`).

## Health and Readiness

Expose `/health` (liveness) and optionally `/ready` (readiness: DB, caches). Return 200 with minimal JSON; use 503 if dependencies are down so load balancers can stop sending traffic.
