# Development Workflow

> **This doc is the orchestrator, and it wins over any skill that disagrees with it.**
> Superpowers is a toolbox I invoke where this doc calls for it — never an auto-pilot. Don't run
> its `brainstorming → writing-plans → subagent-driven-development → finishing` chain
> automatically, and don't treat `using-superpowers`'s "invoke a skill every turn" as binding.

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

### 1. Design — `superpowers:brainstorming`, when intent is unclear

Collaborative dialogue → short design, scaled to complexity, with an approval gate before
implementation. **Optional**: run it when I don't yet know what I want, skip it when I do. For
trivial changes the "design" is one sentence — but still confirm intent before coding.

Skipping it does NOT skip rigor. The gate lives in step 2, not here.

### 2. Plan — `pre-implementation-review`, then ONE combined doc

**Run the `pre-implementation-review` skill.** It is the required beat, and it owns the scout,
the tiering, and the plan critique: bounded scout of the real code first, tier from what the
scout found (surprises, not guessed size), plan at that tier, then critique it — with a
fresh-context subagent on anything that scouted FULL, because a plan self-graded by its author
comes back "looks fine."

The plan's own shape, once that skill calls for one:

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

### 3. Routing — one question, not a ceremony

**The session is Opus, set once and held.** Switching mid-session busts the prompt cache and
re-ingests the whole conversation, so per-task variation is expressed by *delegating*, never by
switching the main thread.

Design, planning and review all run inline, which means they are already on Opus. **Nothing to
route.** The only real routing decision is whether **implementation** gets delegated:

> **The critiqued plan from step 2 is the brief, and therefore the test.** A subagent gets the
> system prompt, CLAUDE.md, and that plan — nothing from our conversation. If the plan names
> exact paths, signatures, and the pattern to mirror, hand it to **Sonnet**. If judgment is left
> that the plan couldn't pre-resolve, keep it inline.

Haiku only for genuinely mechanical fan-out — porting N call sites to a known signature. Say
which you picked in a sentence and carry on; don't build a table or wait for approval. I already
approved the plan at step 2's checkpoint, and that's the same moment.

Escalate to **Fable** only when reasoning depth is the actual bottleneck — a novel architectural
problem, not merely a hard one.

### 4. Execute — inline-first

- **Default inline, on the session model.** Follow TDD (`superpowers:test-driven-development`):
  RED → GREEN → REFACTOR. Inline is the default *because* it needs no brief — I already have the
  context. Only propose a downshift when the cold-brief test above passes.
- **Delegate the residual, not the discovery** — the most common shape for anything non-trivial.
  Step 2's scout already did the expensive part on the session model, and its context is costly
  to transfer. What remains is prescriptive — paths, signature, pattern snippet, verify command —
  and *that* delegates to a cheap model safely, because nothing is left to infer. Splitting this
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
- **`/team-pr-review`** before pushing anything that will become a PR — the deep read against the
  team's recurring topics, plus the behaviour-change ledger. Local only; it never posts. **I invoke
  this one, not you:** it carries `disable-model-invocation: true`, so say the transition has
  arrived and stop. Don't paraphrase the review inline as a substitute — a hand-rolled imitation
  looks like the real thing and silently skips the topics table.
- **`security-reviewer` is not optional** for auth/authz, user input handling, database queries,
  file system operations, external API calls, crypto, or anything touching payments. Any one of
  those in the diff means run it, regardless of how small the change looks.
- **`superpowers:verification-before-completion`** — always. No "done"/"passing" claims without
  fresh command output as evidence.
- **`/test-coverage`** to confirm 80%+ when coverage matters.
- Responding to review feedback → `superpowers:receiving-code-review` (verify before
  implementing; no performative agreement; push back when warranted). Incoming PR comments →
  `receiving-pr-review`.

**Findings reach me in one vocabulary: blocking / should-fix / nit.** Several agents grade
internally on CRITICAL/HIGH/MEDIUM/LOW — that's their detection logic, leave it alone, but
translate on the way out (CRITICAL and HIGH → blocking, MEDIUM → should-fix, LOW → nit). A
finding that won't sit on this scale usually didn't clear the bar.

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
- **Comment triage — a required beat before the PR is opened**, done by
  `/post-implementation-reflection` and its Comments lens: sweep the branch diff, the commit
  bodies, and the session, and route each piece of rationale out of the code and onto the PR.
  **I invoke this one too** (`disable-model-invocation: true`), so prompt me and wait. It still
  has to happen in the session that did the work — triaged cold it degrades into diff narration —
  so raise it while that context is live rather than letting the PR go out without it.

## Model & Effort Reference

| Tier | Model | For |
|------|-------|-----|
| Hardest | **Fable** | Deliberate escalation when reasoning depth is the bottleneck |
| High judgment | **Opus** | The session. Design, architecture, review |
| Balanced | **Sonnet** | Implementation from a prescriptive plan; debugging |
| Cheap/fast | **Haiku** | Mechanical, fully-specified work; parallel fan-out |

- **Effort is a separate knob** (`low`→`max`) and a large cost/latency lever on its own.
  **Default `high`**, set globally in `settings.base.json`. Move it per task, not per session.
- **Subagents do NOT default to cheap** — a generic one inherits the session model. Downshifting
  is deliberate, and gated on the plan being prescriptive enough to hand over.
- **Named agents route themselves.** Every agent in `~/.claude/agents/` pins a model, so invoking
  one is already a routing decision. Don't propose routing for work an agent covers — name the
  agent.
- **Review quality is bought with fresh context before it's bought with a bigger model.** An
  author grading their own work returns "looks fine" on any tier. Delegate the review to get new
  eyes; upgrade the model only where a miss is expensive and a false positive is cheap.
- **Don't start a large refactor or a multi-file feature in the last 20% of the context window.**
  Single-file edits, docs, and simple fixes are fine anywhere.

## Superpowers hook — re-run after every plugin update

Superpowers' `SessionStart` injection is quieted by `scripts/quiet-superpowers-hook.sh`, which
surgically removes the hook from the plugin's own `hooks.json` because Claude Code has no
per-plugin hook toggle. **It is not update-safe — `/plugin update` restores the hook, so re-run
the script after any update.**

## Where Work Happens — Primary Clone, and Which Branch

Two separate decisions, often conflated. **(A)** *which directory* — always my existing clone,
never a worktree unless I approve one. **(B)** *which branch inside it* — depends on whether the
repo is personal or work.

### A. Directory: always my primary clone. NOT a worktree.

Work in the repo directory I already have checked out. I prefer branches — worktrees need extra
setup and repointing that isn't worth it for most work, and I rarely work out of one.

**A worktree requires my explicit OK, asked for BEFORE you create it.** Never create one
silently, never as a "safety" default, never mid-task without stopping. Don't let a skill pull
one in automatically either — that includes `superpowers:using-git-worktrees`,
`subagent-driven-development`, plan execution, and `isolation: 'worktree'` on subagents. If you
think one is genuinely right (parallel agents mutating the same files, or my checkout must stay
runnable with uncommitted work intact), say why a branch won't do in a line or two, and wait.

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

### If I approve a worktree

Location is always `<repo-root>/.claude/worktrees/<branch-name>` — never improvised, never asked
about. Then run `~/.claude/scripts/worktree-bootstrap.sh` from inside it. **Read that script's
header first**: it carries the gitignore requirement, why tracked-files-only breaks local config,
and the polling flags an rspack dev server needs. Both of these override the skill's own
directory-selection and `npm install` steps.
