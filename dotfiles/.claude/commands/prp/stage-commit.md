---
description: Natural language file staging utility — stage files by describing them in plain English. Does NOT commit. Returns staged files to caller.
argument-hint: <target description>
---

# Stage Commit

Staging-only utility. Interprets `$ARGUMENTS` to determine which files to stage, then stops. Committing is handled by the caller (commit skill).

**Input**: $ARGUMENTS

---

## Phase 1 — ASSESS

```bash
git status --short
```

If output is empty → stop: "Nothing to stage."

---

## Phase 2 — INTERPRET & STAGE

| Input | Interpretation | Git Command |
|---|---|---|
| `staged` | Use whatever is already staged | *(no git add)* |
| `*.ts` or `*.py` etc. | Stage matching glob | `git add '*.ts'` |
| `except tests` | Stage all, then unstage tests | `git add -A && git reset -- '**/*.test.*' '**/*.spec.*' '**/test_*' 2>/dev/null \|\| true` |
| `only new files` | Stage untracked files only | `git ls-files --others --exclude-standard \| xargs git add` |
| `the auth changes` | Interpret from status/diff — find matching files | `git add <matched files>` |
| Specific filenames | Stage those files | `git add <files>` |

For natural language inputs, cross-reference `git status` and `git diff` to identify relevant files. Show which files are being staged and why.

```bash
git add <determined files>
```

Verify:
```bash
git diff --cached --stat
```

If nothing staged → stop: "No files matched your description."

---

## Phase 3 — RETURN

Report staged files to the caller:

```
Staged: {count} file(s)
{list of staged files}
```

Control returns to the commit skill to handle pre-commit checks, message generation, and git commit.
