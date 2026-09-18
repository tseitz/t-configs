# Coding Style

## Immutability

Default to returning new objects rather than mutating in place — except where the language's own
idiom says otherwise (Go pointer receivers, for one). Match the surrounding code.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Comments — default to none

**Start at zero, earn each one back.** Apply the test as you write it, not at review time when
the diff is already noisy:

> **Would deleting this let a future change be silently wrong?**

Only "yes" earns one. Everything else is diff commentary and belongs on the PR.

**Yes:** an invariant a cleanup would break · a workaround for a library bug · why a
redundant-looking check is load-bearing · why two similar things are deliberately not shared ·
a non-obvious unit, bound, or ordering requirement.

**No:** restating the line · narrating a rename · a header over a self-evident block · a
docstring repeating the signature · anything longer than the code it describes.

### Trap or story

A trap stops a future editor doing something. A story explains how the code got here. Traps
stay. Stories go on the PR — read once with the diff in hand, then archived, instead of sitting
in the file going quietly false. A wrong comment is worse than none; it is read with the same
trust as the code.

**Mirror test: if the thing it describes changes, does anything fail?** "Nothing" means a second
copy of a fact, and copies drift while the original moves on.

**Worst offender is a name no build here can see** — another service's constant, a class in
another language, a ticket's stated behaviour, a line number, a version, a list of things
defined elsewhere. Nobody renaming those greps this file, and no compiler, linter or test
notices. So:

- **Describe observable behaviour, not the mechanism.** `a suppressed row keeps
  totalProjectedSales` survives the provider renaming its blank-list constant;
  `CPG::BlankedMetrics::RETAILER` does not.
- **Name only what a reader can verify from here** — a symbol in this repo, a wire field, a
  public endpoint or query param. Those the tooling *can* follow.
- **Prefer an assertion.** A test or a type breaks when it stops being true; a sentence doesn't.
  Save the comment for the *why*, which nothing can assert.
- **A duplicated fact is a design smell first.** "These must stay in sync" usually means it
  should be one definition. Fix that and the comment disappears with it.
- **A copied list rots fastest.** "The states in `foo.rb` are a, b, c" goes stale the first time
  someone adds `d`, and reads as authoritative while doing it. Say "grep both files" instead.

### Density — count it, don't estimate it

Your budget is the comment count in the file you're editing *and* its siblings. **A new file's
budget is the directory median — frequently zero.** This is the step that gets skipped:
writing-mode substitutes a felt sense for the real number, and that feeling runs far denser than
most codebases.

```bash
for f in <dir>/*.<ext>; do echo "$(grep -cE '^\s*(//|#)' "$f") $f"; done | sort -rn
```

Adding the first comment to a sparse file is a decision — make it on purpose. Never add one to
code you're touching for an unrelated reason; a comment ships with the code it guards.

### If one earns its place, write it terse

Shortest text that lands the point. Fragments fine, grammar optional. Say WHY — the code already
says what.

- **No cleverness.** Puns stop being funny on someone else's first read.
- **Small words.** Spell out an acronym on first use in the file, including obvious ones.
- **Longer than the code it describes → cut it.**

Governs inline, block, docstrings, JSDoc/TSDoc, module headers and TODOs — not the code itself,
which follows the language's conventions. Terseness is a floor for comments that already passed
the test above, never a reason to write more of them.

Don't rewrite existing comments on a drive-by. Fix them when you're already in that code.

PR-time triage — what stays, what moves up, how to post it — is the
`post-implementation-reflection` skill's Comments lens.

## Error Handling

Never silently swallow an error. A `catch` that logs and continues, or a fallback that hides a
real failure, is the shape to avoid — surface it instead.
