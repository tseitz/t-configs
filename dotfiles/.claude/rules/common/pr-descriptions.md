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
