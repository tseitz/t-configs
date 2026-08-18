# PR Descriptions

## Default: high level. Let the code do the talking.

My PR descriptions have been way too verbose. Correct that. **No template** — just a short piece
of prose that answers *what is changing and why*, plus the key decisions. Aim for something a
reviewer reads in under a minute before opening the diff.

## Rules

- **Describe the change at the level of intent, not implementation.** "Consolidates the two
  report-resolution switches into one registry so CSV and JSON can't disagree" — not a walkthrough
  of the classes involved.
- **Do NOT enumerate every change.** No change-by-change inventory, no per-file or per-rename
  bullet list, no restating renames/moves/spec edits the diff already shows. Enumerations are
  redundant *and* they drift the moment anything changes in review.
- **List the key decisions and the reasoning behind them** — the non-obvious calls a reviewer
  would otherwise have to reverse-engineer or would push back on. That's the part the diff
  genuinely can't convey. A few of them, not a dozen.
- **Prefer inline comments over description prose.** We tend to leave notes as inline PR comments
  on the relevant lines rather than cramming everything into the description. If a point is
  anchored to specific code — a caveat, a "look at this", a why-not-X — it belongs as an inline
  comment on that line, not in the body. Only genuinely PR-wide context goes in the description.
  See [Code comments vs. diff commentary](#code-comments-vs-diff-commentary) below for the routing
  rule; the same triage feeds both the inline comments and what's left for the body.
- **Don't editorialize the process.** No "updated after review" changelogs, no narrating that you
  implemented and then reverted something, no evidence dumps of suite output / lint counts /
  measured baselines. If verification matters, one line is enough.
- **Sections only if they earn it.** A couple of short paragraphs is usually the whole PR. Reach
  for headings only when there's real structure (e.g. a genuinely surprising behaviour change a
  reviewer must not miss). Never add an empty section for form's sake.

## Rough shape

```
<one or two paragraphs: what this changes and why>

<key decisions + why, if there are any worth calling out>

<caller-visible / breaking behaviour change, if any>
```

Ticket links, breaking changes, and anything a deploy depends on always stay in. Brevity is not
an excuse to drop information a reviewer needs — it's an instruction to stop repeating the diff.

## Do NOT hard-wrap the body — one line per paragraph

**GitHub comment fields are not repo `.md` files.** In PR descriptions, review comments, and issue comments, GitHub applies GFM hard-line-breaks: every single `\n` inside a paragraph renders as a literal `<br>`. So a body hard-wrapped at 90–100 columns — correct and conventional in a committed markdown file, where CommonMark folds that newline into a space — arrives as a ragged stack of forced short lines. Nothing is visibly wrong in the source file, which is why this recurs.

So when authoring a body or comment:

- **Write each paragraph as one long unwrapped line.** Let the browser wrap it. Do not reflow to a column limit; the editor's soft-wrap is fine to look at while writing.
- **Separate paragraphs with a blank line.** That's the only break that behaves the same in both contexts.
- **Keep real newlines only where a break is intended** — list items, table rows, fenced code.
- This applies to the text passed via `--body-file`/`--body` too. A clean file (LF endings, no trailing spaces) still renders wrong if the paragraphs are wrapped; whitespace hygiene is not the fix.
- **It's GitHub-specific — don't over-apply it.** Jira descriptions written through the Atlassian MCP fold soft wraps into spaces the normal way (they convert to ADF paragraphs), as do committed `.md` files. Wrapping is only wrong in GitHub comment fields.

Verify rather than eyeball, since the source looks fine either way:

```bash
gh api repos/{owner}/{repo}/pulls/{n} \
  -H "Accept: application/vnd.github.html+json" --jq .body_html | grep -c '<br>'
```

A count higher than the breaks you deliberately wrote means it hard-wrapped. Fix by joining each paragraph onto one line and re-editing with `gh pr edit --body-file`.

## Code comments vs. diff commentary

Code comments document **code**. Everything that only makes sense while the old behaviour is
still visible is **diff commentary**, and it belongs on the PR, not in the repo. Both are worth
writing — they just live in different places.

### The routing test

> **Would deleting this let a future change be silently wrong?** → code comment.
> Otherwise → inline PR comment.

The tell: *does it describe code that won't exist after merge?* If yes, it's diff commentary.
"Used to fall through to…", "was previously named…", "the route ran unvalidated until…" all fail
the test — after merge they describe something the reader cannot see, and `git blame` already
carries the ticket.

Keep in code: invariants a "cleanup" would break, tooling workarounds, why a redundant-looking
check is load-bearing, why a type annotation that looks removable isn't, why two similar things
are deliberately not shared.

Push to the PR: the bug's history and impact, why this approach over the alternative, why a file
*wasn't* changed, why something was left out of scope, test-strategy choices, measurements and
cross-repo facts that justified a decision.

### Capture during implementation, triage at PR time

These are two separate moments, and conflating them is how the rationale gets lost.

- **Capture** — when a decision is made, write it down wherever is cheapest right then: a code
  comment or a commit body. Don't self-censor about where it ultimately belongs. Some of it will
  be deleted later; that's fine and much cheaper than reconstructing it.
- **Triage** — at PR time, sweep the branch diff **plus the commit bodies plus the session**, and
  route each piece by the test above. Comments that fail it come out of the code and go up as
  inline review comments.

**The diff alone is never enough, so never triage cold.** The most valuable PR comments explain
*absences* — why an endpoint was left alone, why an obvious refactor was declined, why a file
isn't in the diff — and a diff cannot show what isn't in it. Other load-bearing facts routinely
live outside the repo entirely: ticket impact tables, consumer behaviour in another repo,
out-of-band product decisions, one-off DB measurements. Run this in the session that did the
work, or deliberately feed it the tickets and cross-repo context first. Triaged cold, the
comments degrade into fluent diff narration — the exact PR noise this rule exists to prevent.

### Posting mechanics

- **Push the comment cuts first, then post.** Comments anchor to line numbers in the PR head;
  posting before pushing the trim means every anchor shifts and GitHub flags them outdated on
  arrival.
- **Post as one review**, not N separate comments.
- **Check for existing comments on the line first** — including your own from earlier rounds.
  Where they overlap, keep whichever is better anchored and trim the other.
- Verify each anchor line falls inside a changed hunk, or the comment won't attach.
