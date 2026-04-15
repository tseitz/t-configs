---
name: commit
description: Always use this skill when committing code changes — never commit directly without it. Handles branch safety, conventional commit format, and smart file staging. Trigger on any commit, git commit, save changes, or commit message task.
---

# Commit

## Step 1 — Branch Guard

```bash
git branch --show-current
```

**If on `main` or `master`**, create a feature branch first — unless the user explicitly asked to commit to main, or CLAUDE.md says to develop directly on main.

```bash
git checkout -b <type>/<short-description>
```

Branch naming: `<type>/<short-description>` matching the commit type (e.g., `feat/add-user-auth`, `fix/null-pointer-error`, `refactor/extract-validation`).

## Step 2 — Pre-Commit Checks

Run the project's local checks before staging anything. Check `package.json`, `Makefile`, `pyproject.toml`, etc. to find the right commands. Typical checks:

- **Tests** — run the test suite (or relevant subset)
- **Typecheck** — e.g., `tsc --noEmit`, `mypy`, `pyright`
- **Lint / Format** — e.g., `eslint`, `ruff check`, `prettier --check`

If any check fails, stop and report. Do not proceed to staging until the working tree is clean.

If no check commands are discoverable, note it and continue.

## Step 3 — Staging

**Does the user's request target specific files or describe a subset of changes?**

Examples of targeted requests:
- "commit the auth changes"
- "commit what we've been working on"
- "commit everything except tests"
- "commit only the new files"
- "commit the migration"

If **yes** → use the Skill tool to invoke `/prp/stage-commit <description>` to handle staging, then continue to Step 4.

If **no** (e.g., "commit my changes", "commit everything", no description) → stage directly:

```bash
git add -A
git diff --cached --stat
```

If nothing staged, stop: "Nothing to commit."

## Step 4 — Commit Message

Format:
```
<type>(<scope>): <subject>

<body>
```

Header required. Scope optional. All lines under 100 characters.

### Types

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `build` | Build system or dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance tasks |
| `style` | Code formatting, no logic change |

### Subject Line Rules

- Imperative, present tense: "Add feature" not "Added feature"
- No period at the end
- Under 72 characters

### Body Guidelines

- Explain **what** and **why**, not how
- Only include if the subject line isn't self-explanatory

```bash
git commit -m "<type>(<scope>): <subject>"
# or with body:
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<body>
EOF
)"
```

## Examples

```
fix(api): handle null response in user endpoint
```

```
feat: add real-time market resolution notifications
```

```
refactor: extract validation logic to shared module

Move duplicate validation from three endpoints into a shared
validator. No behavior change.
```

```
feat(api)!: remove deprecated v1 endpoints

BREAKING CHANGE: v1 endpoints no longer available
```

### Revert

```
revert: feat(api): add new endpoint

This reverts commit abc123def456.
Reason: caused performance regression in production.
```

## Principles

- Each commit should be a single, stable change
- Commits should be independently reviewable
- The repo should be in a working state after each commit
