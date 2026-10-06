# PR Descriptions

## Default: high level. Let the code do the talking.

My PR descriptions have been way too verbose. Correct that. **No template** — just a short piece
of prose that answers *what is changing and why*, plus the key decisions. Aim for something a
reviewer reads in under a minute before opening the diff.

**This replaces the `mattpocock-skills:pr` skill — don't invoke it.** Its template contradicts this
one; the parts worth keeping (the visual, before/after evidence, the one-way door) are in here.

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
- **Don't editorialize the process.** No "updated after review" changelogs, no narrating that you
  implemented and then reverted something, no dumps of suite output / lint counts / measured
  baselines. The Before / after section is the whole proof budget (see Shape).
- **Front-load the risk.** A reviewer's attention budget runs out before the body does. The one
  thing that can go wrong goes near the top, not in the fourth paragraph. A body that is correct
  but flat gets skimmed, and skimming means the risky part is the part they miss.
- **Say each thing once.** Every point lives in exactly one section. If the lead covered it, Key
  decisions doesn't repeat it; if a decision already explains a risk, Where to start passes through
  that file without re-arguing it. A repeat means a section didn't earn its place.
- **Sections only if they earn it, and only from the fixed set below.** A couple of short
  paragraphs is usually the whole PR — leave it bare. Once there's more, use the standard
  headings so every PR reads the same way. Never add an empty section for form's sake, and never
  invent a heading outside the set.

## Shape

The body answers the four questions a reviewer actually opens a PR with: *what is this and did it
do what the ticket asked* · *what does merging it ship* · *where do I start reading* · *what will I
see change, and what proves it*.

```
<lead paragraph — NO heading. What changes and why. 2-4 sentences.>

<optional visual — NO heading. The shape of the code change, in one fenced block.>

## Key decisions
## On merge
## Where to start
## Before / after

<one-line footer: stack position, ticket link. No heading.>
```

- **Lead paragraph** — always present, never gets a heading.
- **Visual** — optional, directly under the lead, which it illustrates. Use one when the change has
  a shape prose would labour over: a call tree gaining a step, a module split, a request crossing
  services, a state machine. Smallest view that lands the point — a `diff`-fenced sketch of the
  before/after shape usually beats a full diagram. Pick the form from the menu in
  `~/.claude/skills/show-me/SKILL.md`, minus its HTML-file option (a PR body can't host one). Keep
  only the calls, files and states the point needs. One visual, rarely two; a change with no shape
  — a config bump, a one-line fix — gets none. It shows how the code is arranged; what someone
  sees change goes in Before / after.
- **Key decisions** — sits right under the lead because the two read as one piece. The lead
  introduces the change; this section expands only the calls in it a reviewer would push back on
  or have to reverse-engineer. Each point is either settled in the lead, or named there and argued
  here — never both in full.
- **On merge** — blast radius: tells the reviewer how expensive a read this needs to be. Include
  it ONLY when the answer isn't the boring default (goes live on the next deploy, self-contained,
  nothing to coordinate). Earned by: ships dark behind a flag ·
  needs a flag flip or config change to activate · deploy order matters (contract tests, a stack,
  a migration) · a caller-visible contract or schema changes · a migration that blocks the deploy ·
  a **one-way door**, anything a revert won't undo (destructive migration or backfill, a contract
  consumers already picked up, data or notifications sent outside our systems). A one-way door
  opens the section, named as one, with what the revert leaves behind. Reversible is the default
  and earns nothing. **Never write "None" here** — if there's nothing to say, delete the heading.
  An empty section is worse than no section, because a heading that's usually empty teaches people
  to skip it.
- **Where to start** — the reading route, told as a short story the reviewer can follow. The file
  to open first and why it's the way in, then where it leads and what each stop adds. Flag the
  stop to slow down on. Two to four stops; any longer and it's the file list again.
- **Before / after** — what changes for someone outside the code, then the test that pins it. A
  reviewer should know what's different once this ships without opening the diff. Pick the form
  by what changes:
  - **Visible change → screenshot pair.** `gh` can't upload images, so leave a visible
    `Before / after: screenshots to add` line and tell me which two to take.
  - **One output changes → that output, before and after,** in a `diff`-fenced block: the log
    line, API response, span attribute or CLI output a person would actually look at. Captured
    output beats a mock; a mock keeps the real field names, trims what doesn't change, and says
    it's a mock.
  - **Several places change → a table,** one row per place someone would look (a log line, a
    Sentry event, a trace span), never per file: *where · before · after*. Fits anything that
    changes what's exposed or allowed — a leak, a permission, a contract. Exempt from the 3–4 cap,
    since each row is a separate place to check; past ~6 rows, group them.
  - Every "before" traces to captured output or the old code. A guess doesn't go in.
  - **Then the proof, red then green:** the assertion that fails without the change and passes
    with it, named so the reviewer can open it, sketched as pseudocode when the name alone doesn't
    say what it pins. Only claim a red you ran — revert the fix and re-run it, never infer it. At
    most two more checks that would sink the change if they failed; a manual check gets one line
    saying what it showed, not the steps you took. Not a coverage list, not a suite dump, no pass
    counts.
- **3–4 bullets per section, max.** More than that means you're enumerating again.
- **Small PRs stay bare.** If the whole thing fits in one paragraph, use no headings at all.
- Drop any section with nothing real in it. Four headings is the ceiling, not a template — most
  PRs won't earn all four.

Ticket links, breaking changes, and anything a deploy depends on always stay in. Brevity is not
an excuse to drop information a reviewer needs — it's an instruction to stop repeating the diff.

## Do NOT hard-wrap the body — one line per paragraph

GitHub comment fields apply GFM hard-line-breaks: every `\n` inside a paragraph renders as a literal `<br>`. A body wrapped at 90–100 columns — correct in a committed `.md` file — arrives as a ragged stack of short lines, and the source looks fine either way, which is why this recurs.

- **Write each paragraph as one long unwrapped line.** Let the browser wrap it.
- **Blank line between paragraphs** — the only break that behaves the same in both contexts.
- Keep real newlines only where a break is intended: list items, table rows, fenced code.
- Applies to `--body-file` and `--body` too. Whitespace hygiene is not the fix; wrapping is.
- **GitHub-only — don't over-apply.** Jira through the Atlassian MCP folds soft wraps normally, as do committed `.md` files.

Verify rather than eyeball:

```bash
gh api repos/{owner}/{repo}/pulls/{n} \
  -H "Accept: application/vnd.github.html+json" --jq .body_html | grep -c '<br>'
```

A count above the breaks you deliberately wrote means it wrapped. Join each paragraph onto one line and re-edit with `gh pr edit --body-file`.

## What belongs inline instead of in the body

Anything anchored to specific code — a caveat, a "look at this", a why-not-X — goes as an **inline comment on that line**, not in the description. Only genuinely PR-wide context belongs in the body.

Sweeping the branch for rationale that should move out of the code and up onto the PR is a separate, required beat before opening it. That triage — what stays in code, what goes up, and the posting mechanics — lives in the **`/post-implementation-reflection`** skill's Comments lens — run it yourself rather than asking. It has to happen in the session that did the work; the routing test itself is in [coding-style.md](coding-style.md).
