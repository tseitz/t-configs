# Development Workflow

> **This doc is the orchestrator, and it wins over any skill that disagrees with it.**
> Skills are tools invoked where this doc calls for one — never an auto-pilot. Don't invoke a
> skill on every turn just because it might apply.

## Core Principle: Tier Everything to the Task

There is no single ceremony level. Plan granularity, execution mode, review depth, and model +
effort **all scale with the size and risk of the task**. Small mechanical change → almost no
ceremony. Multi-file feature → the full flow. A one-line fix does not get a design doc, a
subagent fleet, and a two-stage review.

Two axes drive most decisions:

- **Inline vs. subagent** — Discovery, design, planning and review run **inline** (you keep
  full context, no round-trip tax). Implementation is decided **per task, in the plan** — see
  step 3. A task the plan marks `delegate` goes to a subagent even when nothing runs in
  parallel; the point is the cheaper model, not only the fan-out.
- **Cheap vs. robust** — see the Model & Effort section. Never default the whole flow to the
  most expensive tier.

## The Workflow

### 0. Research & Reuse *(optional lead-in — greenfield / new libraries only)*

Skip for local changes to existing code. For net-new work or unfamiliar libraries: quick
`gh search` + official docs to find an existing pattern to adopt before writing from scratch.
Prefer porting a proven approach over hand-rolling. (This is a lightweight check, not a phase.)

### 1. Design — when intent is unclear

Talk it through before building: a short back-and-forth on what's wanted, scaled to complexity,
with an approval gate before implementation starts. **Optional**: skip it when I already know
what I want. For trivial changes the "design" is one sentence — but still confirm intent before
coding.

Skipping it does NOT skip rigor. The gate lives in step 2, not here.

### 2. Plan — `pre-implementation-review`, then ONE combined doc

**Run the `pre-implementation-review` skill.** It is the required beat, and it owns the scout,
the tiering, and the plan critique: bounded scout of the real code first, tier from what the
scout found (surprises, not guessed size), plan at that tier, then critique it — with a
fresh-context subagent on anything that scouted FULL, because a plan self-graded by its author
comes back "looks fine."

**Inside the Matt Pocock chain, the beat is `to-plan` instead** — `/to-spec` → `/to-tickets` →
`/to-plan #<ticket>` → `/implement`. Same four beats, but the spec already agreed the seams and
the tickets already sliced the work, so `to-plan` carries those forward by reference rather than
re-deciding them, and it reuses one saved scout across every ticket of a spec. It is user-invoked,
like the rest of that chain. **Run one or the other, never both.** No spec upstream →
`pre-implementation-review`.

The plan's own shape, once either skill calls for one:

- **One document, not two.** A single file with a short `## Design` section (the approved
  intent) + `## Tasks`. No separate spec-then-plan artifacts. Reserve two docs only for genuine
  multi-subsystem work where one design anchors several plans.
- **Location: `<repo>/.claude/plans/` — gitignored, ephemeral.** These are working artifacts,
  not deliverables. Do NOT commit them by default; promote one into `docs/` only when I ask to
  share it. Ensure `.claude/plans/` is gitignored.
- **Granularity tiers with execution mode:**
  - *Inline / capable / supervised* → **intent-level**: goal, the units/files in play,
    approach + constraints + gotchas, and how to verify. Leave the *how* to the implementer;
    tell them to reason and surface findings, not transcribe diffs. Literal code only for
    genuinely tricky spots (specific algorithm, exact interface contract, non-obvious gotcha).
  - *Parallel / cheap / unsupervised* → **prescriptive**: exact paths, signatures, and code,
    because you're trading reasoning for determinism and won't be in the loop to correct.
  - Each task carries a short **"considerations / open questions"** so reflection is built in.
  - Each task carries a **route line**: `Route: delegate | inline · Files: <paths> · After:
    <task ids or —>`. The route is set by step 3's rule and checked in the critique. `Files`
    and `After` are what make parallel dispatch safe, so they are not optional.
- **Port from PRP:** include a **"Patterns to Mirror"** section — real snippets from the
  codebase the implementer should match. This is the antidote to over-prescriptive plans:
  point at the pattern, let them reason.
- **Multi-session / multi-PR work → `blueprint` skill** (its niche: dependency graph, parallel
  steps, per-step model tiering, cold-start briefs). Don't force big projects through a single
  plan doc.

### 3. Routing — per task, written into the plan

**Route each task, not the plan.** One open task does not make the whole plan inline — that is
the reflex this step exists to stop. Mark a task `inline` only when it:

- runs a **probe or live measurement** whose answer later tasks are written against
- carries an **open decision** or a **constant to tune** against real output
- is **data-loss, auth or money sensitive**, where a wrong call is expensive to find
- needs a **live, one-shot or account-writing check** to prove it

Everything else is `delegate`. The critiqued plan is the brief: a subagent gets the system
prompt, CLAUDE.md and the plan, nothing from our conversation. A task that fails that test
without matching a bullet above means the plan is missing something — fix the plan.

**Which model a delegated task gets:**

- **Personal repo** → a `general-purpose` agent with `model` unset. The Jev router hook picks
  Haiku or Sonnet, and inherits the session model when unsure. Named agents and forks pin their
  own model, so the router never sees them.
- **Work repo** → the router is off there by design, so pass `model: "sonnet"` explicitly.
- **Haiku** only for genuinely mechanical fan-out — porting N call sites to a known signature.
- **Fable** only when reasoning depth is the actual bottleneck — a novel architectural problem,
  not merely a hard one.

**The two flows spend this differently**, because a model switch mid-session busts the prompt
cache and a new session does not:

| Flow | Skill | Main thread | How a cheaper model is used |
|---|---|---|---|
| **Build here** | `pre-implementation-review` | Opus, held | Subagents take the `delegate` tasks |
| **Hand off** | `to-plan` | Picked at the next session's start | All tasks `delegate` → start that session on Sonnet. Any `inline` → start on Opus and delegate the rest |

Don't wait for approval of the routes separately — I approved them with the plan.

### 4. Execute — Opus leads, subagents type

- **The lead works the plan in task order.** `inline` tasks it does itself. `delegate` tasks
  it dispatches. On a Sonnet session with every task `delegate`, just build — there is nothing
  cheaper to hand to.
- **Brief = plan path + task id + its `Files` + the scoped verify command.** Tell it to read the
  plan's Design, Patterns to mirror and Critique before editing. Keep the brief under 12,000
  characters: the router skips longer ones, and the task silently runs on Opus.
- **Parallel only when it is safe.** Tasks whose `After` is met and whose `Files` do not
  overlap go out in one message. They share one checkout, so:
  - Subagents **do not commit** and run only their **scoped** tests — a full suite run would
    read another agent's half-finished edit.
  - The lead runs the plan's full Verify after each batch, reads the diff, then commits.
- **A delegated task that fails:** read why. Retry once with the fix in the brief; if it fails
  again, take it inline — a second failure means the plan left judgment in it.
- **Parallel across tickets** (two plans at once) needs separate checkouts, so it needs a
  worktree — ask first, per "Where Work Happens".
- Implementer self-reviews before handing back; a single review pass happens at checkpoints or
  at the end (see Review). Reserve the full spec-then-quality two-stage review for
  security-sensitive or architecturally significant tasks.
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
- **`/pr-review`** before pushing anything that will become a PR — the deep read against the
  team's recurring topics, plus the behaviour-change ledger. Local only; it never posts. **I invoke
  this one, not you:** it carries `disable-model-invocation: true`, so say the transition has
  arrived and stop. Don't paraphrase the review inline as a substitute — a hand-rolled imitation
  looks like the real thing and silently skips the topics table.
  - Not to be confused with the `team-pr-review` plugin from `presentation-skills`, which is the
    team-published version of the same idea and *is* model-invocable. `/pr-review` is my copy and
    the one this workflow means.
- **`security-reviewer` is not optional** for auth/authz, user input handling, database queries,
  file system operations, external API calls, crypto, or anything touching payments. Any one of
  those in the diff means run it, regardless of how small the change looks.
- **Verify before claiming done.** No "done"/"passing" claims without fresh command output as
  evidence — always.
- **`/test-coverage`** to confirm 80%+ when coverage matters.
- Responding to review feedback: verify before implementing, no performative agreement, push
  back when warranted. Incoming PR comments → `receiving-pr-review`.

**Findings reach me in one vocabulary: blocking / should-fix / nit.** Several agents grade
internally on CRITICAL/HIGH/MEDIUM/LOW — that's their detection logic, leave it alone, but
translate on the way out (CRITICAL and HIGH → blocking, MEDIUM → should-fix, LOW → nit). A
finding that won't sit on this scale usually didn't clear the bar.

**Secrets.** Never hardcode one; environment variables or a secret manager, always, and validate
that the required ones exist at startup so a missing one fails loudly. **If a secret may have been
exposed, say so immediately and rotate it** — patching the code that leaked it is not enough.

### 6. Debug

Root-cause before fixes — reproduce, isolate, understand why, then fix. 3+ failed fixes →
question the architecture, don't keep patching.

### 7. Commit & Finish

- **`commit` skill** — branch safety, conventional format, staging. Targeted staging routes
  through `/prp:stage-commit`.
- **After tests pass, decide what's next** — merge, open a PR, keep the branch, or discard it.
- **PR creation** — use `/prp:pr` mechanics (template discovery, heredoc-safe bodies). **The body
  itself follows [pr-descriptions.md](pr-descriptions.md) — high level, no change-by-change
  enumeration — which overrides `/prp:pr`'s own verbosity and any repo template's prompting for
  exhaustive detail.**
- **Comment triage — a required beat before the PR is opened**, done by
  `/post-implementation-reflection` and its Comments lens: sweep the branch diff, the commit
  bodies, and the session, and route each piece of rationale out of the code and onto the PR.
  **Invoke it yourself** — unlike `/pr-review` above, this one is model-invocable. Run it when a
  change is built and a PR is next, without waiting to be asked. It has to happen in the session
  that did the work: triaged cold it degrades into diff narration, so the trigger is that
  context still being live, not the PR being ready.

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

## Where Work Happens — Primary Clone, and Which Branch

Two separate decisions, often conflated. **(A)** *which directory* — always my existing clone,
never a worktree unless I approve one. **(B)** *which branch inside it* — depends on whether the
repo is personal or work.

### A. Directory: always my primary clone. NOT a worktree.

Work in the repo directory I already have checked out. I prefer branches — worktrees need extra
setup and repointing that isn't worth it for most work, and I rarely work out of one.

**A worktree requires my explicit OK, asked for BEFORE you create it.** Never create one
silently, never as a "safety" default, never mid-task without stopping. Don't let a skill pull
one in automatically either — that includes plan execution and `isolation: 'worktree'` on
subagents. If you think one is genuinely right (parallel agents mutating the same files, or my
checkout must stay runnable with uncommitted work intact), say why a branch won't do in a line
or two, and wait.

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

Location is always `~/code/worktrees/<repo-name>/<branch-name>` — never improvised, never asked
about. **Central, deliberately not inside the repo.** A worktree nested under the repo root is a
second full copy of the source that file explorers list and that any linter run without an
explicit path walks.

Then run `~/.claude/scripts/worktree-bootstrap.sh` from inside it. **Read that script's header
first**: it carries why tracked-files-only breaks local config, and the polling flags an rspack
dev server needs. Both of these override the skill's own directory-selection and `npm install`
steps.

**Inside Herdr (`HERDR_ENV=1`), let it own the worktree** — its model is one worktree, one
workspace, so each gets its own panes, editor and agent:

```bash
herdr worktree create --branch <name> [--base <ref>]   # creates it and opens the workspace
herdr worktree open --branch <name>                    # an existing one
herdr worktree list
herdr worktree remove --workspace <id>
```

No `--path` needed: `[worktrees] directory` in `~/.config/herdr/config.toml` is set to
`~/code/worktrees` and Herdr appends `<repo-name>/<branch>` itself. Note that key is a single
global base resolved against `$HOME` — it cannot be made repo-relative, which is why the
convention above is central rather than in-repo.

**Exception — PR reviews.** `~/code/worktrees/<repo>/pr-<n>` belongs to
`~/.claude/scripts/review-prs.js` (`/review-assigned-prs`): detached worktrees, one *tab* each in
the `presentation-review` workspace — a shape `herdr worktree` can't produce. `herdr worktree
list/remove` doesn't see them; clean up with `review-prs --prune`.

**One editor per worktree.** Don't `cd` between worktrees inside one long-lived nvim: LSP
clients stay rooted at the directory they attached to, and claudecode.nvim's lock file
advertises a workspace folder that `/ide` then matches against the wrong tree.
