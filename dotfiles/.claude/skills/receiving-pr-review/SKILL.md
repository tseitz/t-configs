---
name: receiving-pr-review
description: Walk through incoming PR review comments one at a time, as a conversation. Presents a single comment per turn with its code and full reply chain, waits for your call on it, then implements only what you agreed to. Never posts anything back to GitHub.
---

# Receiving a PR Review

Work through review comments as a collaborative conversation — **one comment per turn**, like sitting down and going through them together. Read each comment in context, say what you think, then wait for the user's call before moving on.

**Requires**: GitHub CLI (`gh`) authenticated, `uv` available.

**Important**: Never post comments, replies, or reviews back to GitHub. All discussion happens here.

## Bundled Scripts

Reuses `fetch_pr_feedback.py` from the `iterate-pr` skill:

```bash
ITERATE_PR_SKILL=$(dirname ${CLAUDE_SKILL_ROOT})/iterate-pr
uv run ${ITERATE_PR_SKILL}/scripts/fetch_pr_feedback.py [--pr NUMBER]
```

---

## The Interaction Contract (read this before anything else)

This skill exists to make the review a **dialogue**, not a report. The failure mode it
guards against is gathering every comment and emitting one long message of verdicts —
that turns a conversation into a document the user has to audit.

**One message = one comment. Then stop and wait.**

Rules, in order of importance:

1. **Present exactly ONE comment per message, and end that message with the question.**
   Nothing follows the question — no "meanwhile, comment 3 says…", no preview of what's
   next, no "while you consider that, here's my take on the others."
2. **Never form or state an assessment for a comment you haven't presented yet.** Read
   the code for a comment when you reach it, not for all of them up front. Batching the
   *thinking* is what produces batched output.
3. **Wait for an actual reply.** Every comment gets the user's explicit decision. Do not
   infer that a general remark ("these all look fine") settles the remaining comments —
   confirm before treating one answer as covering several.
4. **Do not implement anything mid-walkthrough.** Collect decisions; write code at the end
   (step 6). The one exception is a change so small the user asks for it inline — then do
   it and continue.
5. **Only the summary (step 3) and the wrap-up (step 7) may cover multiple comments.**

Anti-pattern — never do this:

```
Comment 1 of 7 — @reviewer says X. My read: valid, we should fix.
Comment 2 of 7 — @reviewer says Y. My read: disagree because…
Comment 3 of 7 — …
Which of these would you like to address?
```

That is the whole thing this skill is designed to prevent, even when it feels more
efficient. Seven exchanges is the point.

---

## Workflow

### 1. Identify the PR

```bash
gh pr view --json number,url,headRefName,baseRefName,title,author
```

If no PR is found for the current branch, stop and tell the user. If a PR number or URL
was passed as an argument, use `--pr <number>`.

### 2. Fetch All Feedback

```bash
ITERATE_PR_SKILL=$(dirname ${CLAUDE_SKILL_ROOT})/iterate-pr
uv run ${ITERATE_PR_SKILL}/scripts/fetch_pr_feedback.py
```

Fetching everything at once is fine and expected — it's the *presenting* that goes one at
a time. Build the queue now, ordered high → medium → low, and keep it to yourself.

Each inline item carries its whole thread, which changes how you read it:

- **`thread`** — every comment in order, each flagged `is_pr_author`. **Read the entire
  chain before forming a view.** A reviewer's opening concern is often already answered,
  withdrawn, or narrowed further down the thread; judging it from the first comment alone
  produces confident, wrong takes and re-litigates settled points.
- **`author`** / **`full_body`** — the first comment *not* by the PR author. For a thread
  the user opened as diff commentary, this is the reviewer's reply, which is the part that
  needs a decision.
- **`awaiting_author_reply`** — a reviewer had the last word. These are the live ones.
- **`started_by_pr_author`** — the user opened this thread; their note is the first entry
  in `thread` and is context for the reply, not feedback to action.
- **`diff_hunk`** — the code GitHub anchored the thread to.

Silently skip:

- `resolved` threads — already handled
- `bot` comments — informational only (coverage, Dependabot, etc.)

Do not walk through `author_notes` (the user's own inline commentary with no reply). Give
the count in the summary and move on; only raise one if the diff has since drifted and the
note is now wrong.

### 3. Give a Summary First

One short triage message before the walkthrough — the only place a multi-comment overview
belongs:

```
PR #6384 — "refactor(MF-6314): one blanking seam"

Review from @cmccormick-im:
• 0 high
• 5 medium
• 2 low / nits
• 3 threads have replies — 1 still awaiting your response
• 10 of your own inline notes, no replies (skipping)

Going one at a time, starting with the medium items. Ready?
```

### 4. Present One Comment

For the comment at the front of the queue — and only that one:

1. **Read the file** at the path/line, enough of it to judge the comment.
2. **Present the comment** — who, where, what they said, the relevant code, and the full
   reply chain if there is one.
3. **Give your own read** — do you agree? Is it sound? Would you push back? One short
   paragraph, a concrete reason, no hedging both ways.
4. **Ask, then stop.**

```
─── 1 of 7 · medium ─────────────────────────────────

@cmccormick-im — app/models/disabled_publishers.rb:23

> "Is this substantially different from the `for_campaign` method
>  above? What prevents the caller from just passing the campaign?"

Code at that line:
  def self.for_campaign_id(campaign_id)
    for_campaign(Campaign.find(campaign_id))
  end

My read: fair — it's a thin wrapper, and the only caller already has
the campaign loaded. Inlining it removes a redundant query. I'd take
this one.

Accept, push back, or skip?
```

When the thread has replies, show it as a conversation and say where it stands:

```
─── 3 of 7 · medium ─────────────────────────────────

app/serializers/.../report_serializer.rb:37 — 5 comments, awaiting your reply

@cmccormick-im: "Can you expand on what this field represents?"
  ↳ @you: "Trying to prevent null data being conflated with zero."
@cmccormick-im: "Does the user need to know why values are null?"
  ↳ @you: "Removed it entirely for now (912639a)."
@cmccormick-im: "Right, but the UI has specific elements that need to
                 distinguish those cases."

Where it stands: you removed the field; they're saying the UI still
needs the distinction, so the removal may have gone too far.

My read: they have the stronger claim — if the UI branches on it, the
field needs to come back, though as an explicit enum rather than the
comment-documented null it was. This one needs a real decision.

How do you want to handle it?
```

### 5. Handling the Response

Note the decision in a running ledger you keep to yourself, then move to the next comment
— which means a **new message** with just that comment.

- **"Accept" / "yes" / "fair"** — note as agreed. Next comment.
- **"Push back" / "disagree"** — if they gave a reason, note it. If not, offer your own
  take or ask for theirs. Note as declined, with the reason, so step 7 can restate it.
- **"Skip" / "not now"** — note as skipped. Next comment.
- **"What do you think?"** — you already gave your read; commit to it in one sentence
  rather than re-listing the trade-offs. Then let them decide.
- **Anything ambiguous** — ask about *this* comment. Don't advance the queue to fill time.

If the user answers with a question about the code, answer it and re-ask. The comment isn't
done until they've decided.

### 6. Low-Priority Items

Nits get the same one-at-a-time treatment by default. When you reach them, offer the
shortcut once — this is the only place batching is on the table, and only at the user's
request:

```
That's the medium items done. 2 nits left:
  • app/services/campaign_reports.rb:13 — comment detail
  • .../campaign_reporting.rb:7 — usable outside a controller?

One at a time, or batch them?
```

If they say batch, list them numbered and take a `"1,3"` / `"all"` / `"none"` answer.
Otherwise continue as in step 4.

### 7. Implement Agreed Changes

Only once the walkthrough is done:

1. List every agreed change before touching code:
   ```
   Implementing 3 agreed changes:
   • disabled_publishers.rb:23 — inline for_campaign_id into its caller
   • campaign_reports.rb:31 — move the guard to the controller
   • results_controller_spec.rb:137 — build records instead of mocking
   ```
2. Make changes one file at a time, reading each file before editing.
3. Run the repo's own lint and test commands — take them from its `CLAUDE.md`,
   `package.json`, or `Makefile` rather than assuming a stack.
4. Use the `commit` skill to commit.

### 8. Final Summary

```
Done.

Addressed (3):
✓ disabled_publishers.rb — inlined the wrapper
✓ campaign_reports.rb — guard moved to the controller
✓ results_controller_spec.rb — real records, mocks dropped

Declined (2):
• publisher_dashboard_control.rb:97 — the two methods differ in scope;
  worth replying on the thread to explain
• campaign_reports.rb:13 — nit, leaving as-is

You still owe a reply on report_serializer.rb:37.
```

Flag anything the user should answer on GitHub themselves — declined comments and threads
where the reviewer had the last word. You never post; they do.

---

## Push-Back Heuristics

Consider pushing back when:

- **Already answered in the thread** — check the reply chain first; the point may be
  settled or withdrawn
- **Already fixed elsewhere** — visible in the reviewer's diff view, resolved in a later commit
- **Design decision already made** — the pattern is intentional and consistent across the
  codebase; the reviewer may not have seen the full picture
- **Nit on style, not correctness** — preference with no practical impact
- **Suggestion introduces complexity** — abstraction not earned at current scale
- **Reviewer misread the code** — the concern doesn't apply given actual runtime behavior

Always give a concrete reason, not just disagreement. And don't manufacture push-back for
balance — if the reviewer is right, say so plainly and move on.

---

## Exit Conditions

**Done:** Every high/medium comment presented individually and decided. Low-priority items
presented (or batched at the user's request) and decided. Agreed changes committed.

**Stop early:** User says "that's enough" or "skip the rest." Commit what was agreed, and
say which comments were never reached.

**No feedback:** All threads resolved or bot-only — say so and stop.

---

## Fallback (if the script fails)

The GraphQL thread query is what carries reply chains; the REST endpoints below return
replies as flat comments linked by `in_reply_to_id`, so reassemble threads before
presenting.

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate \
  --jq '.[] | {id, in_reply_to_id, path, line, user: .user.login, body}'
gh api repos/{owner}/{repo}/issues/{number}/comments --paginate
gh pr view --json reviews,reviewDecision
```
