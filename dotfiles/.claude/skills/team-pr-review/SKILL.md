---
name: team-pr-review
description: Reviews the current diff the way the presentation team would — orientation, premise check, the team's recurring review topics, a behaviour-change ledger, then architecture and product-owner lenses. Treats the PR description and ticket as claims to verify, never as facts. Run it yourself with /team-pr-review before pushing. Local findings only; never posts to GitHub.
disable-model-invocation: true
---

# Team PR Review

Reviews the current diff the way a teammate would — locally, never posted to
GitHub. It **sets the table** for the reviewer, **checks against the team's
recurring topics**, **ledgers the behaviour changes** a merge would ship, then
**steps back** for architecture, a would-I-do-it-this-way-again read, and a
product-owner lens.

## The standing rule — the code is the only evidence

The PR description, the commit messages, the ticket, and the code comments are all
**claims made by the author**. They are input for *what was intended*, never evidence
of *what the change does*. Every statement about behaviour in this review must be
grounded in a line you read in the diff (or in the surrounding code you opened to
trace it).

That means:

- Never write "this handles the null case" because the description says so. Open the
  function and find the guard, or report that you couldn't.
- Never accept a scoping claim ("no behaviour change", "pure refactor", "backwards
  compatible", "fully covered by tests") as true. Those four are the highest-value
  claims to check, because they're the ones reviewers wave through.
- Never let the description tell you which files matter. Read every changed hunk;
  the unmentioned ones are where the surprises live.
- A ticket describing behaviour is describing the behaviour someone *wanted*, which
  may differ from what shipped, and from what the rest of the product already does.
- Where the diff and the prose disagree, the diff wins and **the gap is a finding**
  (Step 4).

Apply this in every step below, not just the ones that mention it.

## Step 1 — Load the team topics

Read `references/team-review-topics.md` (bundled with this skill) — the distilled
table of topics the team habitually raises in review, ranked by frequency. This
table is the source of truth for the line-level review.

If it is missing or empty, STOP — do not review against an empty knowledge base.
Report that the topics table is absent, and regenerate it with the runbook at
`local/pr-review-distill/RUNBOOK.md` in the presentation workspace.

## Step 2 — Resolve the diff to review

Run from the repo being reviewed:

```bash
branch="$(git branch --show-current)"
base="$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || true)"
# No PR yet: ask the remote what its default branch is rather than guessing from a
# candidate list. Base branches genuinely vary across our repos (development /
# develop / main / master), and a guess that misses silently degrades this review
# into "uncommitted changes only".
if [ -z "$base" ]; then
  base="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
fi
# origin/HEAD isn't always set locally; `git remote set-head origin -a` fixes that.
if [ -z "$base" ]; then
  base="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
fi
if [ -z "$base" ]; then
  echo "could not determine the base branch — pass it explicitly" >&2
fi
if [ -n "$base" ] && [ "$base" != "$branch" ]; then
  git fetch -q origin "$base" 2>/dev/null || true
  git diff "$(git merge-base "origin/$base" HEAD)"...HEAD
else
  git diff HEAD   # fallback: uncommitted changes
fi
```

If the diff is empty, report "no changes to review" and stop.

## Step 3 — Set the table (orient the reviewer)

Before any line-level findings, give the reviewer the lay of the land so they can
dive in fast. First gather the **stated intent** — remember it's a claim (see the
standing rule): it tells you what to test the diff against, not what the diff does.

```bash
# Derive a ticket key from the branch, PR title, or PR body. MF (project
# "Measurement Presentation") is the common case, but keep the pattern generic
# so it doesn't rot as the team's stack/projects widen.
key="$(git branch --show-current | grep -oiE '[A-Z]+-[0-9]+' | head -1)"
[ -z "$key" ] && key="$(gh pr view --json title,body -q '.title + " " + .body' 2>/dev/null | grep -oiE '[A-Z]+-[0-9]+' | head -1)"
echo "ticket: ${key:-none}"
gh pr view --json title,body 2>/dev/null || true   # PR description as fallback intent
```

- If a ticket key was found and the Atlassian MCP is available, fetch the issue's
  title + description for the statement of intent (see the workspace jira-ticket
  workflow doc for field/response gotchas).
- Otherwise use the PR title/body as the intent. If neither exists, say so and
  assess against the change itself only — don't invent a ticket.

Then write a short orientation — **scale it to the diff**: one or two sentences
for a trivial change, a tight paragraph for a feature. Write it **from the code you
read**, not by paraphrasing the description; if the two produce different summaries,
that's Step 4's finding. Cover:

- **What & how** — what the change accomplishes and the approach/mechanism it uses.
- **Trade-offs** — the notable choices made and what they cost (not an exhaustive list).
- **Does it satisfy the ticket?** — map the change to the ticket's intent; call out
  anything the ticket asked for that's missing, or scope the PR adds beyond it.
- **Where to start reading** — the 1–3 files/hunks that carry the core of the change,
  so the reviewer reads those first.

This is orientation, not a findings list — keep it to the map, not the critique.

## Step 4 — Challenge the stated approach

The description and the ticket are **claims, not facts**. A description can read as
perfectly reasonable and still be describing the wrong fix, or a different change than
the one in the diff. Before reviewing the lines, judge the premise:

- **Does the diff do what the description says?** Drift between the blurb and the code
  is a finding in its own right — and it means the rest of the review goes by the code,
  not the summary.
- **Which claims did you check, and which failed?** Pull the concrete assertions out of
  the description, ticket, and commit bodies — "no behaviour change", "only affects
  admins", "the old path is unused", "covered by tests" — and verify each against the
  code. Report the ones that don't hold, and name any you could not verify from the diff
  alone so the author supplies the missing evidence instead of the reviewer assuming it.
- **Is this the best way to solve the problem?** Read past the stated *how* to the
  underlying problem and ask where it's most cheaply and durably fixed. The recurring
  shapes: patching a symptom at the display layer when the cause is upstream (or the
  reverse — a backend change for what is really a presentation concern); adding a new
  path alongside an existing mechanism that already covers the case; a workaround for a
  constraint that has since lifted; a per-caller fix where the shared helper is the real
  site.
- **Is the ticket's framing itself right?** Tickets often prescribe a solution, and a PR
  can faithfully implement the wrong one. Flag when the requested behaviour contradicts
  behaviour elsewhere, when the premise looks stale, or when satisfying the ticket
  literally makes the product worse.

Hold the same bar as everywhere else here: raise an alternative only when it is
**materially** better, and say what switching would cost — including "not worth changing
now, but worth knowing." Don't manufacture one for form's sake; "the approach fits the
problem" is a valid and common outcome, and saying so plainly is useful.

Frame these as questions to the author, not verdicts. They may be acting on a product
call, a cross-repo constraint, or a deploy-ordering requirement that isn't visible in
the diff — and a confidently wrong "you should have done X" costs more review time than
it saves.

## Step 5 — Review against each topic

Go topic-by-topic through the reference against the changed hunks. **Gate by layer:**
skip topics whose layer can't apply to the files that changed (don't run the
RSpec/rswag topic against a TS-only diff). **Lead with the highest-frequency topics** —
they're the team's sharpest lens — and go deep on them rather than skimming all 26. For
a perennial heavy-hitter, apply its full checklist; e.g. error handling (topic #9):
empty or overly-broad catches, log-and-continue, a value that can be null with no
fallback, a default that silently masks a real failure, an error swallowed instead of
surfaced.

For each candidate, **rate your confidence 0–100** that it's a real issue a teammate
would actually raise, then **surface only findings ≥ 80.** Trace the actual runtime
path before flagging — don't flag from pattern-matching alone (topic #18). This gate is
how "a short accurate review beats a long noisy one" gets enforced: everything below the
bar is dropped silently, never listed as a "maybe."

Each surfaced finding carries:

- **file:line** (absolute path for clickability)
- **topic** it maps to (from the reference) and **severity** — blocking / should-fix /
  nit (mirror how the team weights it)
- **what & why** — the concrete issue and the suggested change, in a teammate's voice
- **consequence** — the specific failure, regression, or cost this prevents (a concrete
  scenario, not "this is bad practice"). If you can't name one, it's probably below the
  confidence bar — drop it.

## Step 6 — Behaviour-change ledger: what ships if we merge today

Separate from the findings: **an explicit list of every observable change in
behaviour this diff introduces.** The question is literally "if this merged today,
what changes, and what could break?" Derive it from the code, never from a "no
behaviour change" claim — that claim is exactly what this step exists to test.

List every change you can trace, each with **what changes**, **who sees it**, and
**how you'd know it went wrong**. Sweep these sources of change, not just the
obviously-behavioural ones:

- **User-visible** — UI output, wording, defaults, empty/loading/error states, what a
  chart or export now contains (or now blanks).
- **API & contract** — request/response shape, new required params, a field's type or
  nullability, status codes, pagination. Note anything that needs a **Pact** consumer
  contract published first, or that breaks a consumer in another repo.
- **Data** — migrations, backfills, a column's meaning changing, writes that now happen
  (or stop happening), anything irreversible.
- **Permissions & scope** — who can now see or do something they couldn't, or lost.
- **Performance & load** — a new query per row, a lost cache, a new external call.
- **Deploy & ordering** — does another repo, a migration, or a flag have to land first?
  Is the change safe on a partial rollout, and safe to roll back after it has run?
- **Config & env** — a new env var or secret that must exist, or a default that changes
  for anyone who hasn't set it.
- **Silent-until-later** — behaviour behind a flag, a cron, a rare branch, or a
  scheduled job that won't surface on merge day but will surface.

Then close with the two things a merge decision actually needs:

- **What to watch after deploy** — the specific dashboard, log line, Sentry issue, or
  report that would show this going wrong first.
- **Rollback** — is reverting the commit enough, or has something become one-way
  (migration run, data rewritten, contract published, cache format changed)?

If the change genuinely alters no observable behaviour, say so **and name what you
checked** to conclude that. "None — pure rename, all call sites updated, no
serialized/persisted names involved" is a useful answer; a bare "none" is not.

## Step 7 — Step back: architecture, simplification & adaptability

The topic pass in Step 5 works line-by-line. This step is deliberately
higher-altitude — read the change as a whole and ask whether the *design* is right,
not whether a given line matches a topic. Apply YAGNI in both directions: flag
over-engineering AND designs too rigid to absorb the obvious next case.

- **Could this be simpler?** — unnecessary abstraction, indirection, or config for a
  case that isn't here yet; a hand-rolled mechanism where a simpler/existing one fits.
- **Will it adapt?** — when the change introduces an enum, union, config shape, or
  branching structure, probe the *likely next value*: if today's `twiceWeekly` becomes
  `biWeekly`/`biMonthly` tomorrow, does that need a rewrite or is the design open to it?
  Flag closed vocabularies hardcoded in multiple places (the classic "add one value,
  edit five files" smell).
- **More / less scope** — is the change doing too much (split it) or too little to be
  coherent (a half-built abstraction that'll bite the next person)?
- **Longer-term cost** — what will realistically change here later, and does this design
  make that change cheap or expensive (migration, deploy ordering, cross-repo ripple)?

Keep it honest and brief. If the design is sound, say "no architectural concerns"
rather than manufacturing one — this pass earns its keep on the changes that need it.

## Step 8 — "Would I build it this way again?"

One deliberate question, asked after you've read the whole change and know what it
cost: **starting over with what you now know, is this the implementation you'd
write?** It's a different question from Step 4 (which judged the *approach* against
the problem) and from Step 7 (which judged the *design* against the future). This
one is hindsight on the execution — the shape you'd only see having read the diff end
to end.

The recurring answers:

- The pieces landed in the wrong order, so a later hunk undoes or works around an
  earlier one — the same thing done twice, or a helper added and then bypassed.
- Two-thirds of the diff is incidental (a rename, a reformat, a drive-by) and would
  have been cleaner as its own commit or PR.
- The seam is in the wrong place: the change touches five files because the split
  between them is wrong, and one file would have done it.
- The tests were written to the implementation rather than the behaviour, so they'd
  pass on a version of this that's broken.
- Nothing — it's what you'd write again. Say that; it's the common case and it's
  worth stating.

Then convert it to something actionable: **is it worth changing now, or is it a
note for next time?** Say which. A "I'd do it differently" that costs a day of
rework on a shipped-and-correct change is a lesson, not a review comment — label it
as such rather than dressing it up as a should-fix.

## Step 9 — The product-owner lens

Last pass, and a different hat: **read the change as someone who knows this product
deeply** — who knows how the reports are actually used, what customers ask for, what
broke last quarter. Not "is the code good" but **"would that person be happy with
this?"**

Ask, grounded in the behaviour ledger from Step 6:

- **Does this actually solve the user's problem**, or just the narrow case in the
  ticket? The near-miss shape: the fix is correct for the example in the ticket and
  wrong for the neighbouring case nobody wrote down.
- **Is it consistent with the rest of the product?** A control that behaves one way
  here and another way on the sibling report is a bug to a user even when both are
  individually correct. Same for wording, defaults, date handling, and rounding.
- **What happens on the ugly real-world input** — no data, one row, partial data, a
  huge account, a permission the developer doesn't have, an in-flight campaign? These
  are the states real usage produces and local testing doesn't.
- **Would a customer notice this and be confused or annoyed?** Silent blanking,
  numbers that no longer reconcile with another report or an export, a value that
  changed meaning without being renamed.
- **Is anything here going to generate a support question?** If yes, that's either a
  change to make now or a heads-up the team needs before it ships.

Use the codebase to ground this rather than inventing product opinions: how the
neighbouring feature behaves, what the existing tests assert about expected output,
what the ticket's acceptance criteria imply. Where you genuinely don't know the
product intent, **ask it as a question for the team** — "does publisher-scoped view
expect this column blank or zero?" is a valuable review comment; a confident guess
about product behaviour is not.

## Step 10 — Report

In this order:

1. **Orientation** (Step 3) — the reviewer reads this first.
2. **Premise check** (Step 4) — description/diff drift, unverified claims, or a
   genuinely better approach. It outranks anything in the hunks, and a reviewer who
   reads it first reads the rest differently. If the approach holds up, one line
   saying so is enough.
3. **Behaviour changes if merged today** (Step 6) — its own clearly-labelled section,
   not folded into the findings. It's the section a reviewer or release manager reads
   on its own, so keep it scannable: a short list, plus what to watch and whether
   rollback is clean.
4. **Topic findings** (Step 5) grouped by severity, most severe first.
5. **Architecture notes** (Step 7).
6. **Would I build it this way again** (Step 8) — one short paragraph, marked
   "change now" or "note for next time".
7. **Product-owner read** (Step 9) — including the open questions for the team.

Add a brief **what's solid** line — one or two things the change does well — so the
review is balanced, not just a defect list; skip it only if nothing stands out. End
with a one-line summary (e.g. "solid; 2 should-fix, 1 nit — error-handling + a rigid
enum worth widening; one behaviour change needs a Pact publish first").

Sections that came up empty collapse to one line each ("no architectural concerns",
"no observable behaviour change — checked X and Y"). Don't pad, and don't drop them
silently either: a reviewer needs to know the pass ran.

This is review, not repair: report findings with suggested fixes, but do NOT edit the
code, post to GitHub, or commit — it's a local pre-push read.
