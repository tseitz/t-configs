# Development Workflow

> **This is my authoritative workflow. It supersedes the Superpowers default orchestration.**
> Superpowers is a *toolbox* I invoke where this doc calls for it — NOT an auto-pilot. Do not
> run the `brainstorming → writing-plans → subagent-driven-development → finishing` hard-chain
> automatically, and do not treat `using-superpowers`'s "invoke a skill on every turn" as
> binding here. When this doc conflicts with a skill, **this doc wins** (per Superpowers' own
> priority: user instructions > skills > system).

## Core Principle: Tier Everything to the Task

There is no single ceremony level. Plan granularity, execution mode, review depth, and model +
effort **all scale with the size and risk of the task**. Small mechanical change → almost no
ceremony. Multi-file feature → the full flow. A one-line fix does not get a design doc, a
subagent fleet, and a two-stage review.

Two axes drive most decisions:

- **Inline vs. subagent** — Default to **inline** (you keep full context, no round-trip tax).
  Reach for subagents only when they actually pay off: **parallel fan-out** (2+ genuinely
  independent tasks) or **context isolation** (a task big/noisy enough to pollute the main
  thread). Pick per task — subagent-first is fine when parallelism dominates.
- **Cheap vs. robust** — see the Model & Effort section. Never default the whole flow to the
  most expensive tier.

## The Workflow

### 0. Research & Reuse *(optional lead-in — greenfield / new libraries only)*

Skip for local changes to existing code. For net-new work or unfamiliar libraries: quick
`gh search` + official docs to find an existing pattern to adopt before writing from scratch.
Prefer porting a proven approach over hand-rolling. (This is a lightweight check, not a phase.)

### 1. Design — `superpowers:brainstorming`

Keep as-is; it works well. Collaborative dialogue → short design, scaled to complexity, with an
approval gate before implementation. **No separate PRD step** (`/prp:prd` is cut). For truly
trivial changes, the "design" can be one sentence — but still confirm intent before coding.

### 2. Plan — ONE combined doc, intent-level

- **One document, not two.** A single file with a short `## Design` section (the approved
  intent) + `## Tasks`. No separate spec-then-plan artifacts. Reserve two docs only for genuine
  multi-subsystem work where one design anchors several plans.
- **Location: `<repo>/.claude/plans/` — gitignored, ephemeral.** These are working artifacts,
  not deliverables. Do NOT commit them by default; promote one into `docs/` only when I ask to
  share it. Ensure `.claude/plans/` is gitignored (like the worktrees convention below).
- **Granularity tiers with execution mode:**
  - *Inline / capable / supervised* → **intent-level**: goal, the units/files in play,
    approach + constraints + gotchas, and how to verify. Leave the *how* to the implementer;
    tell them to reason and surface findings, not transcribe diffs. Literal code only for
    genuinely tricky spots (specific algorithm, exact interface contract, non-obvious gotcha).
  - *Parallel / cheap / unsupervised* → **prescriptive**: exact paths, signatures, and code,
    because you're trading reasoning for determinism and won't be in the loop to correct.
  - Each task carries a short **"considerations / open questions"** so reflection is built in.
- **Port from PRP:** include a **"Patterns to Mirror"** section — real snippets from the
  codebase the implementer should match. This is the antidote to over-prescriptive plans:
  point at the pattern, let them reason.
- **Multi-session / multi-PR work → `blueprint` skill** (its niche: dependency graph, parallel
  steps, per-step model tiering, cold-start briefs). Don't force big projects through a single
  plan doc.

### 3. Model & Effort Plan — ALWAYS propose, wait for confirmation

Before executing anything non-trivial, **propose a model + effort assignment per stage/task as
a table and wait for my OK.** Do not silently inherit the session model for subagents. Use the
`/model-route` heuristic. This is a required, visible beat — not buried advice. See the
reference table below.

### 4. Execute — inline-first

- **Default inline.** Follow TDD (`superpowers:test-driven-development`): RED → GREEN → REFACTOR.
- **Subagents** only for parallel fan-out (`superpowers:dispatching-parallel-agents` for
  independent problems) or isolation. When using `subagent-driven-development` as the engine,
  **strip the mandatory 3-agents-per-task review loop** — implementer does TDD + self-review;
  a single review pass happens at checkpoints or at the end (see Review). Reserve the full
  spec-then-quality two-stage review for security-sensitive or architecturally significant tasks.
- **Validation standard (ported from `/prp:implement`):** verify in levels as appropriate —
  static/lint → unit → build → integration → edge. Don't claim done before the relevant levels pass.

### 5. Review — single pass by default

- **`/code-review`** on the diff (it has real teeth — gates commits via the pre-commit hook).
  One pass for most work. Escalate to the full two-stage / specialized-agent sweep only for
  security, auth, payments, or architectural changes.
- **`superpowers:verification-before-completion`** — always. No "done"/"passing" claims without
  fresh command output as evidence.
- **`/test-coverage`** to confirm 80%+ when coverage matters.
- Responding to review feedback → `superpowers:receiving-code-review` (verify before
  implementing; no performative agreement; push back when warranted).

### 6. Debug — `superpowers:systematic-debugging`

Root-cause before fixes. No competitor in either suite; keep it. 3+ failed fixes → question the
architecture, don't keep patching.

### 7. Commit & Finish

- **`commit` skill** — branch safety, conventional format, staging. Targeted staging routes
  through `/prp:stage-commit`.
- **`superpowers:finishing-a-development-branch`** — the "what next" menu (merge / PR / keep /
  discard) after tests pass.
- **PR creation** — use `/prp:pr` mechanics (template discovery, heredoc-safe bodies); best
  PR-body logic of the tools available.

## Model & Effort Reference

Model and effort are **two independent knobs.** Effort (`low`→`max`) is a large cost/latency
lever on top of model choice. **Default effort: `high`.** Propose both per the Model Plan step.

| Tier | Model | For |
|------|-------|-----|
| Hardest | **Fable** | Super-complicated / deepest-reasoning tasks |
| High judgment | **Opus** | Default session; design, architecture, security review |
| Balanced | **Sonnet** | Integration, debugging, multi-file coordination |
| Cheap/fast | **Haiku** | Mechanical, well-specified work; parallel fan-out workers |

- **Subagents do NOT default to cheap.** A generic subagent inherits the session model (Opus);
  named agents are pinned in their frontmatter. Downshift deliberately in the Model Plan.
- **Don't flip-flop models/effort mid-session.** Switching resets the prompt cache — the new
  model re-ingests the whole conversation once (a real cost/latency tax, not data loss). Decide
  in the Model Plan and switch once.

## Superpowers Skills I Keep (as building blocks)

`brainstorming` · `test-driven-development` · `systematic-debugging` ·
`verification-before-completion` · `receiving-code-review` · `dispatching-parallel-agents` ·
`using-git-worktrees` (overridden by the convention below) · `finishing-a-development-branch` ·
`blueprint` (multi-session).

## Demoted / Cut

- **Cut:** `/prp:prd` (brainstorming is the only design front door).
- **Demoted:** `using-superpowers` auto-pilot (this doc is the orchestrator); the mandatory
  per-task two-stage review in `subagent-driven-development`; `/plan` and `/prp-plan` as
  entry points (their one durable asset — the pattern table — is ported into step 2).
- **Superpowers `SessionStart` injection is quieted** via `scripts/quiet-superpowers-hook.sh`.
  Claude Code has no per-plugin hook toggle, so that script surgically removes the hook from
  the plugin's `hooks.json`. **It is NOT update-safe — re-run it after any `/plugin update`**
  (the update restores the hook).

## Workspace Isolation (Git Worktrees)

When creating a git worktree — including via the `using-git-worktrees` skill — use this fixed convention. Do NOT improvise a location from `git worktree list`, external tooling paths (e.g. `~/.superset/worktrees/`), or the skill's `~/.config/superpowers/...` fallback, and do NOT ask which directory to use.

- **Location:** `<repo-root>/.claude/worktrees/<branch-name>` — always project-local, inside the repo's own `.claude/` directory.
- **Before creating:** ensure `.claude/worktrees/` is gitignored (add the line and commit if missing). `.claude/` itself is often tracked; the `worktrees/` subdirectory must not be.
- **After creating:** run `~/.claude/scripts/worktree-bootstrap.sh` from inside the new
  worktree. Git worktrees carry only TRACKED files, so gitignored local config (`.env*`,
  `mise.local.toml`) and `node_modules` don't come across. The script copies those
  gitignored env files from the main worktree and installs deps with the repo's package
  manager (mise-aware); it's idempotent and refuses to run in the main worktree. This
  replaces the skill's generic `npm install` step. To then *run* an rspack dev server
  from a worktree, prefix with `CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true` to avoid
  a chokidar `EMFILE` crash.
- This preference overrides the skill's default directory-selection priority.
