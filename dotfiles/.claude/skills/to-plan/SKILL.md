---
name: to-plan
description: "Turn one ticket into a grounded, critiqued implementation plan before /implement runs. The chain-native sibling of pre-implementation-review: assumes a spec and tickets already exist, and never re-opens what they settled."
disable-model-invocation: true
---

# To Plan

One ticket in, one reviewed plan out.

`to-tickets` writes behaviour, not mechanism — its template forbids file paths and code
snippets because they go stale. So something still has to decide *how*. Today that happens
inside `implement`'s first beat, in its head, unreviewed. This skill makes that step an
artifact and attacks it while changing it is still free.

```
to-spec → to-tickets → to-plan → implement → code-review
```

## Invocation

You type `/to-plan #<ticket>`. One ticket per run, same rhythm as `implement`.

**Confirm the ticket back before you start.** A bare `#64` resolves against whatever numbered
list is visible — a todo file, a checklist, another tracker — and it resolves confidently, so
a wrong match is not obvious until work has begun. Read the ticket, state its title and its
parent spec, and stop if either looks wrong.

## What this skill does not own

The chain settled these upstream. Re-opening them is the failure mode this skill has to avoid,
because a plan that quietly contradicts an agreed decision looks exactly like a plan.

| Already decided | Owner |
|---|---|
| Where the feature is tested from (the seams) | the spec |
| The problem, and the solution's shape | the spec |
| What is out of scope | the spec |
| How the work is sliced, and in what order | the tickets |
| Expand–contract for a wide refactor | the tickets |

If the code contradicts one of these, that is a **finding**, not a licence to re-decide. Say so
and stop for the human.

For work with no spec upstream — a fix that never went through the chain — use
`pre-implementation-review` instead. It carries the seam and slicing beats this skill drops.

---

## Step 1 — Scout: reuse, or build and save

Tickets from one spec sit in the same few modules. Scouting each one from scratch pays for the
same reads N times.

1. Look for `<repo>/.claude/plans/scout-<spec-number>.md`.
2. If it exists and already covers the files this ticket touches, **read it and move on.**
3. Otherwise scout, and **append** what you found to that file (create it if absent). Never
   overwrite — a later ticket reaches files an earlier one did not.

Answer from the code, citing `file:line`:

1. **Which files does this actually touch?** Not which the ticket named — which you found.
2. **Who calls them?** Every call site.
3. **What existing pattern should this mirror, and where does it live?** Is it applied
   consistently, or does each caller do it differently?
4. **What command will prove this worked?** Name it exactly.
5. **What do existing tests already assert** about the behaviour you're about to change?

If you cannot answer these in a handful of reads, record that as an unknown rather than
guessing.

## Step 2 — Carry forward, by reference

Pull these from the spec and the ticket, and **cite them rather than restate them**:

- the seams the feature is tested at
- the implementation and testing decisions
- what is out of scope
- the ticket's acceptance criteria

A plan that repeats the spec in its own words has created a second copy that will drift from
the first. Point at `#63`; do not paraphrase it.

**Departures get flagged loudly.** If the scout shows a spec decision cannot hold, name the
decision, name the `file:line` that contradicts it, and raise it in Step 5's output. Do not
route around it quietly.

## Step 3 — Tier, from what the scout found

`to-tickets` sized this ticket to fit one context window. That is not the same question as
whether its mechanism is obvious.

Count the surprises:

- More call sites than expected
- The pattern to mirror doesn't exist, or isn't applied consistently
- The change crosses a boundary — module, repo, API contract, schema, another service
- You had to open a file neither the ticket nor the spec mentioned
- Existing tests assert behaviour this will change
- You can't name the verification command
- A spec decision looks contradicted by the code
- **The scout itself wasn't cheap** — that is the ticket telling you it isn't small

**Zero surprises → SHORT. One or more → FULL.** State which you picked and the surprise that
decided it, in one line. When torn, go FULL — a wrong SHORT is the failure this skill exists to
prevent, and a wasted FULL costs one subagent.

## Step 4 — Plan the mechanism

**SHORT** — a few sentences inline: what changes, where, and the verify command. No document.

**FULL** — write `<repo>/.claude/plans/issue-<n>-<slug>.md` with these sections:

- **`## Design`** — the mechanism, at code level. The *problem* belongs to the spec; what
  belongs here is which functions, types and seams change, and why each call was made.
- **`## Patterns to mirror`** — real snippets from this codebase the implementer should match.
  This is what lets the plan stay short: point at the pattern instead of transcribing it.
- **`## Tasks`** — grouped by file, in the order they must land.
- **`## Verify`** — the exact commands, plus anything they do not cover.

### Name symbols in the Tasks, not line numbers

**`file:line` belongs in the scout. `file:symbol` belongs in the Tasks.**

The scout is read once, before any edit, so a line number there is accurate and is the proof
you opened the file. The Tasks are read *during* editing — and the plan's own earlier tasks
move the lines its later tasks cite. A plan that says "extract `levels.py:86-89`" in task 1 and
"delete lines 238-248" in task 2 has invalidated itself by the time task 2 runs.

Write "`shortlist`'s truncation tail", not "`levels.py:86-89`". Symbols survive the edit;
directional is good enough.

Carry the scout's citations into the Design. A step naming a file the scout never opened is an
assumption, and Step 5 will ask about it.

## Step 5 — Critique the plan

**SHORT** — answer the questions below inline, briefly.

**FULL** — dispatch a **fresh-context subagent** and give it the plan, the scout, the ticket and
the spec. Do not self-review a FULL plan: the model that wrote it will grade it "looks fine,"
which is the default failure mode, not a result.

The questions, hardest first:

- **Claims vs. facts.** Which parts of this plan were verified in the scout, and which are
  assumed? Name every assumption explicitly. This is the highest-value question — most plans
  that half-work were written without opening enough code.
- **Does it still match the spec?** Every departure from an agreed decision, named, with the
  `file:line` that forced it.
- **Is the seam right?** Not *where should the seam be* — the spec settled that. Does this plan
  actually test at the agreed seam, or has the mechanism quietly pushed the test lower?
- **What else changes if this lands?** Callers, contracts, persisted data, permissions,
  performance, deploy ordering.
- **How will we know it worked** — and how would we know it silently didn't?
- **Do the acceptance criteria all have a task?** Name any criterion no task delivers.

Every finding cites `file:line`, a step of the plan, or a spec decision. A question with no
citation is not a finding — answer "nothing to flag" and move on.

## Step 6 — Checkpoint, then hand off

**Stop. Present, and wait.** No code before approval.

Fold accepted findings into the plan and say what changed. If a finding is rejected, say so in
one line rather than silently dropping it — the rejected ones are worth having on record when
the plan turns out to be wrong later.

Then print the handoff, exactly. `implement` reads the ticket, not this plan, and
`.claude/plans/` is gitignored — nothing will find the plan unless the invocation names it:

```
Next: /implement #<n> — plan at .claude/plans/issue-<n>-<slug>.md
```

---

## Output Format

```
### Ticket
#<n> "<title>" — parent spec #<n>

### Scout
[reused .claude/plans/scout-<n>.md, or:]

| What | file:line | Finding |
|---|---|---|
| Files touched | ... | ... |
| Call sites | ... | ... |
| Pattern to mirror | ... | consistent? |
| Verify command | — | ... |
| Existing assertions | ... | ... |

[anything you could not determine, named as such]

### Tier
SHORT or FULL — and the surprise that decided it

### Plan
[SHORT: a few sentences + verify command]
[FULL: path to the plan doc, plus a 3–5 bullet summary]

### Critique
**Assumptions:** [what was assumed rather than verified — or "none, all steps cite the scout"]
**Spec departures:** [each one, cited — or "none, the plan holds every decision"]
**Seam:** [does the plan test at the agreed seam — or the finding]
**Blast radius:** [what else changes — or "self-contained"]
**Verification:** [the commands, and the gap they don't cover]
**Criteria coverage:** [any acceptance criterion with no task — or "all covered"]

### Open questions for you
[anything the code couldn't answer — product intent, cross-repo behaviour, a business rule]

Next: /implement #<n> — plan at .claude/plans/issue-<n>-<slug>.md
```

Then stop for approval.

## Relationship to other skills

- **`pre-implementation-review`** — the same four beats for work with **no spec upstream**. It
  owns the seam agreement and the slicing rules this skill drops, because in the chain those
  belong to `to-spec` and `to-tickets`. Run one or the other, never both.
- **`to-tickets`** — produces the ticket this consumes, and owns how the work is sliced.
- **`implement`** — consumes the plan. It commits to the current branch and does not close the
  ticket, so reconcile the acceptance criteria yourself afterwards.
- **`post-implementation-reflection`** — the other end of the pair. This checks the plan before
  the code exists; that checks the code after.
- **`blueprint`** — for multi-session work with its own adversarial review gate. Don't run both.
