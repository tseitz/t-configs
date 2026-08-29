---
name: pre-implementation-review
description: Before building anything non-trivial — scout the code, size the task from what the scout found, plan at that size, then have the plan critiqued before any code is written. The pre-implementation half of the pair with post-implementation-reflection. Use when starting a feature, a refactor, or a fix that isn't a one-liner, and whenever a plan exists that nobody has checked.
---

# Pre-Implementation Review

The gate before code. Its job is to catch a plan that will not survive contact with the
codebase — while changing it is still free.

Runs in four beats: **scout → tier → plan → critique**, then stops for approval.

## When to Use

- Starting a feature, refactor, or non-trivial fix
- A plan exists (yours, mine, or a ticket's) and nobody has checked it
- Any change to auth, payments, a schema, or a public contract — regardless of size

Skip only for changes with no design decision in them: a typo, a version bump, a rename with
one call site.

---

## Step 0 — Scout. Always. Bounded.

**Do not skip this to save time, and do not let it become research.** The scout is the
measuring instrument for every decision below. Answer these from the code, citing `file:line`:

1. **Which files does this actually touch?** Not which the task named — which you found.
2. **Who calls them?** Every call site.
3. **What existing pattern should this mirror, and where does it live?** Is it applied
   consistently, or does each caller do it differently?
4. **What command will prove this worked?** Name it exactly.
5. **What do existing tests already assert** about the behaviour you're about to change?

If you cannot answer these in a handful of reads, stop reading and record that — see below.

## Step 1 — Tier, from what the scout found

**Size is not the measure. Surprise is.** You cannot judge size before doing the work, and a
guess made now is made by the same model that is about to do the work.

Count the surprises:

- More call sites than expected
- The pattern to mirror doesn't exist, or isn't applied consistently
- The change crosses a boundary — module, repo, API contract, schema, another service
- You had to open a file the task never mentioned
- Existing tests assert behaviour this will change
- You can't name the verification command
- **The scout itself wasn't cheap** — that is the task telling you it isn't small

**Zero surprises → SHORT. One or more → FULL.** State which you picked and the surprise that
decided it, in one line. When torn, go FULL — a wrong SHORT is the failure this skill exists
to prevent, and a wasted FULL costs one subagent.

## Step 2 — Plan at that tier

Granularity and location follow `rules/common/development-workflow.md` §2 — apply it, don't
restate it here.

- **SHORT** — a few sentences inline: what changes, where, and the verify command. No document.
- **FULL** — the combined `## Design` + `## Tasks` doc in `<repo>/.claude/plans/`.

Carry the scout's citations into the plan. A step that names a file the scout never opened is
an assumption, and Step 3 will ask about it.

## Step 3 — Critique the plan

**SHORT** — answer the questions below inline, briefly.

**FULL** — dispatch a **fresh-context subagent** (`Explore`, or a general-purpose agent) and
give it the plan, the scout findings, and these questions. Do not self-review a FULL plan: the
model that wrote it will grade it "looks fine," which is the default failure mode, not a result.

The questions, hardest first:

- **Claims vs. facts.** Which parts of this plan were verified in the scout, and which are
  assumed? Name every assumption explicitly. This is the highest-value question — most plans
  that half-work were written without opening enough code.
- **Is this the real problem?** Does the plan fix the cause, or the symptom that got reported?
  The recurring shape: patching the display layer when the cause is upstream, or adding a new
  path beside an existing mechanism that already covers the case.
- **Is the seam right?** If it touches five files, is that because the split between them is
  wrong and one file would do?
- **What else changes if this lands?** Callers, contracts, persisted data, permissions,
  performance, deploy ordering.
- **How will we know it worked** — and how would we know it silently didn't?
- **What are we deliberately not doing, and why?**

Every finding cites `file:line` or a specific step of the plan. A question with no citation is
not a finding — answer "nothing to flag" and move on.

## Step 4 — Checkpoint

**Stop. Present, and wait.** No code before approval.

Fold accepted findings into the plan and say what changed. If a finding is rejected, say so in
one line rather than silently dropping it — the rejected ones are worth having on record when
the plan turns out to be wrong later.

---

## Output Format

```
### Scout
[file:line citations for the five questions — or what you couldn't determine]

### Tier
SHORT or FULL — and the surprise that decided it

### Plan
[SHORT: a few sentences + verify command]
[FULL: path to the plan doc, plus a 3–5 bullet summary]

### Critique
**Assumptions:** [what was assumed rather than verified — or "none, all steps cite the scout"]
**Real problem:** [finding or "the plan addresses the cause"]
**Seam:** [finding or "nothing to flag"]
**Blast radius:** [what else changes — or "self-contained"]
**Verification:** [the command, and the gap it doesn't cover]
**Not doing:** [deliberate exclusions]

### Open questions for you
[anything the code couldn't answer — product intent, cross-repo behaviour, a business rule]
```

Then stop for approval.

## Relationship to other tools

- **`post-implementation-reflection`** — the other half of the pair. This one checks the plan
  before the code exists; that one checks the code after. Same depth vocabulary, same
  cite-or-say-nothing rule.
- **`superpowers:brainstorming`** — runs *before* this when the intent itself is unclear. This
  skill assumes you know what you want and asks whether the approach survives the codebase.
  Skipping brainstorming is fine; skipping this is what makes a plan wild-west.
- **`blueprint`** — for multi-session, multi-PR work. It has its own adversarial review gate;
  don't run both.
