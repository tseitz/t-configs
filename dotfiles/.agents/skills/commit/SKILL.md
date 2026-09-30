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
- **Lint / Format** — e.g., `eslint`, `oxlint`, `ruff check`, `prettier --check`
- **Dead code / unused exports** — if the project defines a `knip` script (or `ts-prune`, `depcheck`), run it; these pass typecheck and lint, so they get missed otherwise

Run every check the project defines, not just the obvious ones — scan all relevant `package.json` scripts (e.g. `lint`, `typecheck`, `knip`, `format`) rather than assuming a standard set.

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

If **yes** → run the `/prp:stage-commit <description>` command to handle staging, then continue to Step 4.

If **no** (e.g., "commit my changes", "commit everything", no description) → stage directly:

```bash
git add -A
git diff --cached --stat
```

If nothing staged, stop: "Nothing to commit."

## Step 4 — Commit Message

Conventional Commits, with these house rules:

- Subject under 72 characters, body lines under 100.
- Body explains **what** and **why**, never how. Omit it when the subject says everything.
- Match the scope vocabulary already in `git log` for this repo rather than inventing one.

Write the message with a heredoc so the body keeps its line breaks:

```bash
git commit -F - <<'EOF'
<type>(<scope>): <subject>

<body>
EOF
```

## Principles

- Each commit should be a single, stable change
- Commits should be independently reviewable
- The repo should be in a working state after each commit
