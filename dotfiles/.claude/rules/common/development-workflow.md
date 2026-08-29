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

Before executing anything non-trivial, **propose a model + effort plan as a table and wait for
my OK.** This is a required, visible beat — not buried advice. Use the `/model-route` heuristic.
See the reference table below.

**The unit of routing is the subagent, not the phase.** The session model is ONE decision, made
once at the top and held for the whole session — switching it mid-session busts the prompt cache
and re-ingests the entire conversation. Per-task model assignment applies *only to delegated
work*, because a subagent carries its own context and its own model: dispatching a Haiku subagent
from an Opus session costs the main thread nothing.

This collapses the two axes into one decision:

> **If a task's right model differs from the session model, that IS the signal to delegate it.
> If it stays inline, it inherits the session model and there is nothing to route.**

So the table has two kinds of rows, and they must be labeled as such:

| Task | Mode | Model / effort |
|------|------|----------------|
| Design the schema change | inline | *session model* |
| Port 6 call sites to the new signature | delegated | Haiku / low |
| Security review of the auth path | delegated (`security-reviewer`) | pinned Sonnet |

Never propose a table that implies the main thread changes model between phases. If most rows
want a model the session isn't on, that's an argument for changing the *session* model once
before starting — not for switching partway.

**The downshift gate — the cold-brief test:**

> **If I can't write the brief cold, the task can't be downshifted.** A subagent receives the
> system prompt, CLAUDE.md, and the prompt I write — and *nothing* from our conversation. A
> cheap subagent's ceiling is its brief. So the ability to write a self-contained prescriptive
> brief (exact paths, signature, pattern to mirror, verification command) is the test for
> whether Haiku/Sonnet can take the task. If writing that brief costs as much reasoning as
> doing the work, do it inline on the session model.

### 4. Execute — inline-first

- **Default inline, on the session model.** Follow TDD (`superpowers:test-driven-development`):
  RED → GREEN → REFACTOR. Inline is the default *because* it needs no brief — I already have the
  context. Only propose a downshift when the cold-brief test above passes.
- **Scout inline, delegate mechanically** — the hybrid, and the most common shape for anything
  non-trivial. Do discovery on the session model (read the code, find the pattern to mirror,
  choose the approach); that's the part where context accumulates and is expensive to transfer.
  What's left is prescriptive — paths, signature, pattern snippet, verify command — and *that*
  residual delegates to a cheap model safely, because nothing is left to infer. Splitting this
  way is what makes downshifting real rather than hopeful.
- **Subagents** only for parallel fan-out (`superpowers:dispatching-parallel-agents` for
  independent problems) or isolation. When using `subagent-driven-development` as the engine,
  **strip the mandatory 3-agents-per-task review loop** — implementer does TDD + self-review;
  a single review pass happens at checkpoints or at the end (see Review). Reserve the full
  spec-then-quality two-stage review for security-sensitive or architecturally significant tasks.
- **Validation standard (ported from `/prp:implement`):** verify in levels as appropriate —
  static/lint → unit → build → integration → edge. Don't claim done before the relevant levels pass.

### 4b. Findings found mid-task — ASK. Never file one unprompted.

When you hit a real gap, defect, or better approach while building something else, **bring it to
me and default to proposing a fix now.** Do NOT silently write it into a backlog —
`docs/IMPROVEMENTS.md`, a TODO file, a tracker, an issue — unless I say to defer it.

**Why:** filing is not free. An entry *is* a decision to defer, and making that decision on my
behalf is how a tracker grows past the point anyone reads it. Most findings surfaced mid-task
are cheaper to fix in the moment than to describe well enough for someone to action cold later.
A repo rule that says "write it down and keep going" is about not *derailing* and not *dropping*
— it is not permission to choose deferral silently.

Where a project's own CLAUDE.md defines the tracker's format, that still governs what an entry
looks like **once I've agreed to add one**. This rule governs whether it gets added at all.

### 5. Review — single pass by default

- **`/code-review`** on the diff (it has real teeth — gates commits via the pre-commit hook).
  One pass for most work. Escalate to the full two-stage / specialized-agent sweep only for
  security, auth, payments, or architectural changes.
- **`team-pr-review`** before pushing anything that will become a PR — the deep read against the
  team's recurring topics, plus the behaviour-change ledger. Local only; it never posts.
- **`security-reviewer` is not optional** for auth/authz, user input handling, database queries,
  file system operations, external API calls, crypto, or anything touching payments. Any one of
  those in the diff means run it, regardless of how small the change looks.
- **`superpowers:verification-before-completion`** — always. No "done"/"passing" claims without
  fresh command output as evidence.
- **`/test-coverage`** to confirm 80%+ when coverage matters.
- Responding to review feedback → `superpowers:receiving-code-review` (verify before
  implementing; no performative agreement; push back when warranted). Incoming PR comments →
  `receiving-pr-review`.

**One severity scale, `team-pr-review`'s: blocking / should-fix / nit.** Don't introduce a second
vocabulary — a finding that can't be placed on this scale is usually one that didn't clear the bar.

**Secrets.** Never hardcode one; environment variables or a secret manager, always, and validate
that the required ones exist at startup so a missing one fails loudly. **If a secret may have been
exposed, say so immediately and rotate it** — patching the code that leaked it is not enough.

### 6. Debug — `superpowers:systematic-debugging`

Root-cause before fixes. No competitor in either suite; keep it. 3+ failed fixes → question the
architecture, don't keep patching.

### 7. Commit & Finish

- **`commit` skill** — branch safety, conventional format, staging. Targeted staging routes
  through `/prp:stage-commit`.
- **`superpowers:finishing-a-development-branch`** — the "what next" menu (merge / PR / keep /
  discard) after tests pass.
- **PR creation** — use `/prp:pr` mechanics (template discovery, heredoc-safe bodies). **The body
  itself follows [pr-descriptions.md](pr-descriptions.md) — high level, no change-by-change
  enumeration — which overrides `/prp:pr`'s own verbosity and any repo template's prompting for
  exhaustive detail.**
- **Comment triage — a required beat before the PR is opened.** Sweep the branch diff, the commit
  bodies, and the session, and route each piece of rationale by the test in
  [pr-descriptions.md](pr-descriptions.md#code-comments-vs-diff-commentary): would deleting it let
  a future change be silently wrong? If not, it comes out of the code and goes up as an inline
  review comment. Do this in the session that did the work — triaged cold it degrades into diff
  narration. Commit and push the cuts *before* posting, or the anchors land outdated.

## Model & Effort Reference

Model and effort are **two independent knobs.** Effort (`low`→`max`) is a large cost/latency
lever on top of model choice. **Default effort: `high`.** Propose both per the Model Plan step.

| Tier | Model | For |
|------|-------|-----|
| Hardest | **Fable** | Super-complicated / deepest-reasoning tasks |
| High judgment | **Opus** | Default session; design, architecture, security review |
| Balanced | **Sonnet** | Integration, debugging, multi-file coordination |
| Cheap/fast | **Haiku** | Mechanical, well-specified work; parallel fan-out workers |

- **Subagents do NOT default to cheap.** A generic subagent inherits the session model (Opus).
  Downshift deliberately in the Model Plan, gated on the cold-brief test.
- **Named agents already route themselves.** Every agent in `~/.claude/agents/` pins a model in
  frontmatter — `architect` and `planner` on Opus, the rest (`code-reviewer`, `tdd-guide`,
  `python-reviewer`, `security-reviewer`, `refactor-cleaner`, `typescript-reviewer`, …) on
  Sonnet. Invoking one is already a downshift and costs the session model nothing. Don't
  propose routing for work a named agent covers — just name the agent.
- **The session model is set once, at the top.** Switching mid-session resets the prompt cache —
  the new model re-ingests the whole conversation (a real cost/latency tax, not data loss). If
  the Model Plan reveals the session is on the wrong tier, switch once *before* executing, then
  hold. Per-task variation is expressed by delegating, never by switching the main thread.
- **Don't start a large refactor or a multi-file feature in the last 20% of the context window.**
  Single-file edits, docs, and simple fixes are fine anywhere.

## Superpowers Skills I Keep (as building blocks)

`brainstorming` · `test-driven-development` · `systematic-debugging` ·
`verification-before-completion` · `receiving-code-review` · `dispatching-parallel-agents` ·
`using-git-worktrees` (**demoted — ask first**, see below) · `finishing-a-development-branch` ·
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

## Where Work Happens — Primary Clone, and Which Branch

Two separate decisions, often conflated. **(A)** *which directory* — always my existing clone,
never a worktree unless I approve one. **(B)** *which branch inside it* — depends on whether the
repo is personal or work.

### A. Directory: always my primary clone. NOT a worktree.

Work in the repo directory I already have checked out — the primary working directory, the one I
have open. Do NOT reach for a git worktree as a matter of course, and do NOT let a skill pull one
in automatically — that includes `superpowers:using-git-worktrees`, `subagent-driven-development`,
plan execution, and `isolation: 'worktree'` on subagents.

**A worktree requires my explicit OK, asked for BEFORE you create it.** If you think one is
genuinely the best option — parallel agents mutating the same files, or I need my current
checkout to stay runnable with my uncommitted work intact — state in one or two lines why a
branch won't do, then wait for me to say yes. Never create one silently, never as a "safety"
default, and never mid-task without stopping to ask.

### B. Branch: personal → default branch directly; work → feature branch

| Repo | Where I commit | Notes |
|---|---|---|
| **Personal** (e.g. `tseitz/t-configs`) | **directly on the default branch** (`main`) | Don't branch, don't ask, don't offer. Commit and push to `main`. |
| **Work** (`NinthDecimal/*`, `ThinkNear/*`) | **a feature branch** | Never commit to the base branch. Branch off that repo's base — which is NOT always `main`. |

**How to tell:** the origin remote's GitHub org. `NinthDecimal` or `ThinkNear` → work. Anything
else → personal. Check it (`git remote get-url origin`) rather than guessing from the directory
name.

**On work repos, the base branch varies by repo** — several are `develop`-based and MCM uses
`development`, not `main`. Confirm the repo's actual base before branching or opening a PR;
don't assume `main`.

**This overrides the `commit` skill's Step 1 branch guard** (and any similar "if on main, branch
first" reflex): on a personal repo, being on `main` is correct and needs no prompt. The guard
still applies on work repos.

### If I approve a worktree, use this fixed convention

Do NOT improvise a location from `git worktree list`, external tooling paths (e.g. `~/.superset/worktrees/`), or the skill's `~/.config/superpowers/...` fallback, and do NOT ask which directory to use.

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
