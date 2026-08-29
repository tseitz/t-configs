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

**Start from zero comments and earn each one back.** Before writing one, apply the routing
test at the moment you write it — not at review time, when the diff is already noisy:

> **Would deleting this let a future change be silently wrong?**

Only "yes" earns a comment in the repo. Everything else is either already obvious from the
code, or it is diff commentary that belongs on the pull request instead. The PR-time triage —
what stays, what moves up, and how to post it — is the `post-implementation-reflection` skill's
Comments lens.

**"Yes" looks like:** an invariant a cleanup would break · a workaround for a tool or library
bug · why a redundant-looking check is load-bearing · why two similar things are deliberately
not shared · a non-obvious unit, bound, or ordering requirement.

**"No" looks like:** restating what the line does · narrating a rename or the old behaviour ·
a header over a self-evident block · a docstring that repeats the signature · anything longer
than the code it describes.

**Match the file's density, and round down — and read that number, don't estimate it.** Count
the comments in the file you're editing *and* in its sibling files in the same directory; that
count is your budget. **A new file has no density of its own, so its budget is the directory's
median — which is frequently zero.** This is the step that gets skipped: writing-mode never
looks at the neighbours, so a felt sense of "about right" substitutes for the real number, and
that felt sense runs far denser than most codebases.

```bash
for f in <dir>/*.<ext>; do echo "$(grep -cE '^\s*(//|#)' "$f") $f"; done | sort -rn
```

Adding the first comment to a sparse file is a decision — make it on purpose, not by reflex.
Never add comments to code you're touching for an unrelated reason; a comment lands with the
code it guards, not as a drive-by improvement.

### If a comment earns its place, write it plain

A comment exists to be understood by a tired person at 2am, so it is held to a plainer
standard than the code around it. Write in the spirit of ASD-STE100 Simplified Technical
English:

- **One idea per sentence.** Short sentences. Active voice.
- **Small words.** Define an unavoidable domain term in the same comment. Spell out an
  acronym on first use in the file, including ones that feel obvious to you.
- **Say WHY, not WHAT.** The code already says what it does. The comment carries the reason,
  the invariant, or the trap.
- **No cleverness.** Puns and allusions stop being funny on someone else's first read.

This governs inline comments, block comments, docstrings, JSDoc/TSDoc, module headers, and
TODO notes — not the code itself, which still follows the language's conventions and the
file's existing style. Plain language is a floor for comments that already passed the test
above. It is never a reason to write more of them.

Don't rewrite existing comments just to plain-ify them. Improve them when you're already
editing that code for another reason.

## Error Handling

Never silently swallow an error. A `catch` that logs and continues, or a fallback that hides a
real failure, is the shape to avoid — surface it instead.
