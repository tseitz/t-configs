---
name: pre-implementation-review
description: Before building anything non-trivial — scout the code, size the task from what the scout found, plan at that size, then have the plan critiqued before any code is written. The pre-implementation half of the pair with post-implementation-reflection. Use when starting a feature, a refactor, or a fix that isn't a one-liner, and whenever a plan exists that nobody has checked.
---

# Pre-Implementation Review

The gate before code. Its job is to catch a plan that will not survive contact with the
codebase — while changing it is still free.

Runs in four beats: **scout → tier → plan → critique**, then stops for approval.

Skip only for changes with no design decision in them: a typo, a version bump, a rename with
one call site. Auth, payments, a schema, or a public contract never qualify, regardless of size.

**A spec upstream? Use `to-plan` instead** — see Relationship to other tools. Never both.

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

If you cannot answer these in a handful of reads, stop reading and record it as an unknown
rather than guessing. An expensive scout is itself a surprise — it is the last item in Step 1.

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

**SHORT** — a few sentences inline: what changes, where, and the verify command. No document.

**FULL** — write `<repo>/.claude/plans/<slug>.md` with these sections:

- **`## Design`** — the approved intent, and the mechanism at code level: which functions, types
  and seams change, and why each call was made.
- **`## Patterns to mirror`** — real snippets from this codebase the implementer should match.
  This is what lets the plan stay short: point at the pattern instead of transcribing it.
- **`## Tasks`** — grouped by file, in the order they must land, each with its considerations or
  open questions.
- **`## Verify`** — the exact commands, plus anything they do not cover.

Carry the scout's citations into the Design. A step that names a file the scout never opened is
an assumption, and Step 3 will ask about it.

### Name symbols in the Tasks, not line numbers

**`file:line` belongs in the scout. `file:symbol` belongs in the Tasks.**

The scout is read once, before any edit, so a line number there is accurate and is the proof
you opened the file. The Tasks are read *during* editing — and the plan's own earlier tasks
move the lines its later tasks cite. A plan that says "extract `levels.py:86-89`" in task 1 and
"delete lines 238-248" in task 2 has invalidated itself by the time task 2 runs.

Write "`shortlist`'s truncation tail", not "`levels.py:86-89`". Symbols survive the edit;
directional is good enough.

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

## Step 4 — Checkpoint, then route

**Stop. Present, and wait.** No code before approval.

Fold accepted findings into the plan and say what changed. If a finding is rejected, say so in
one line rather than silently dropping it — the rejected ones are worth having on record when
the plan turns out to be wrong later.

**A finding can invalidate the tier, not just the plan.** A SHORT that turns out to cross a
boundary or change asserted behaviour was mis-tiered — go back to Step 1 and redo it as FULL.
Folding a tier finding into a SHORT plan keeps the wrong ceremony.

Then route, per `rules/common/development-workflow.md` §3. One question: would a subagent with
only the system prompt, CLAUDE.md and this plan know what to do? Yes → hand it to Sonnet. No →
stay inline. Say which in a sentence; the approval above was the same moment.

`.claude/plans/` is gitignored and a subagent gets nothing but what you name, so print the path:

```
Plan: .claude/plans/<slug>.md
Next: <inline | delegate to Sonnet — this plan is the brief>
```

**Not `/implement`** — that reads a ticket, which this path doesn't produce.

---

## Output Format

**SHORT** — prose, not a form. The scout's five answers with their citations, the tier and its
deciding surprise, the plan in a few sentences, the critique questions answered briefly, then
the route. Anything the code could not answer goes at the end as an open question for the user.

**FULL** — the same beats as headed sections: `### Scout` (the five answers, each citing
`file:line`, plus anything you could not determine, named as such) · `### Tier` · `### Plan`
(path to the doc and a 3–5 bullet summary) · `### Critique` (one line per question, each a
finding with a citation or "nothing to flag") · `### Open questions for you` · the route block.

Either way, stop for approval.

## Relationship to other tools

- **`to-plan`** — the same four beats for work that *does* have a spec upstream. It carries the
  spec's seam and slicing decisions by reference instead of re-deciding them, reuses one saved
  scout across a spec's tickets, and hands off to `/implement`. **Run one or the other, never
  both.** No spec → this skill.
- **`post-implementation-reflection`** — the other half of the pair. This one checks the plan
  before the code exists; that one checks the code after. Same depth vocabulary, same
  cite-or-say-nothing rule.
- **`blueprint`** — for multi-session, multi-PR work. It has its own adversarial review gate;
  don't run both.
- **`/implement`** — chain-only. It reads a ticket, so it has nothing to read on this path, and
  its tail conflicts with `development-workflow.md` §5 and §7. Route per Step 4 instead.
