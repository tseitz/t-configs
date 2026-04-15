# Development Workflow

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Official docs second:** Check the library or framework's official documentation to confirm API behavior, package usage, and version-specific details before implementing.
   - **Exa only when the first two are insufficient:** Use Exa for broader web research or discovery after GitHub search and primary docs.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.

1. **Plan First** — choose the right tier:

   | Tier | When | Command |
   |------|------|---------|
   | Quick | Simple feature, clear scope, 1 PR | `/plan` — conversational, waits for confirmation |
   | Feature | Complex feature, needs codebase pattern extraction | `/prp-plan <description or path/to/prd.md>` |
   | Project | Multi-PR, multi-session work | `blueprint` skill |

   - `/prp-plan` accepts a feature description directly, or a `.prd.md` file from `/prp prd`
   - Sub-commands (`/prp implement`, `/prp stage-commit`, `/prp pr`, `/prp prd`) are available but not the usual entry point

2. **TDD Approach**
   - **`tdd-guide` agent** — enforces the discipline, triggers proactively on new features and bug fixes
   - **`tdd-workflow` skill** — detailed reference: patterns, git checkpoints, mocking, framework examples
   - RED → GREEN → REFACTOR, always in that order
   - Verify 80%+ coverage before marking work done

3. **Code Review**
   - Use **code-reviewer** agent immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Test Coverage**
   - Run `/test-coverage` after implementation to verify 80%+ coverage
   - Generates missing tests for uncovered branches, error paths, and edge cases
   - Re-run until coverage passes before moving to commit

5. **Pre-Commit Checks**
   - Resolve any merge conflicts and ensure branch is up to date with target branch
   - The `commit` skill runs tests, typechecks, lint, and formatting automatically before staging

6. **Commit & Push**
   - Use the `commit` skill — handles branch safety, staging, and conventional commit format
   - For targeted staging ("commit the auth changes") it routes through `/prp/stage-commit` automatically
