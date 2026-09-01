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

### A comment that can go stale silently does not earn its place

**Fastest test: is this a trap or a story?** A trap stops a future editor doing something — an
invariant, a load-bearing check, a footgun in a library. A story explains how the code got here
or what it affects elsewhere. Traps stay. Stories go on the PR, where they are read once by
someone with the diff in front of them and then archived, instead of sitting in the file being
re-read and slowly becoming false.

The routing test above asks whether deleting the comment could make a future change wrong.
Ask the mirror question too: **if the thing this comment describes changes, does anything
fail?** If nothing does, the comment is a second copy of a fact — and copies drift while the
original moves on. A wrong comment is worse than no comment, because it is read with the same
trust as the code.

**The riskiest kind names something no build in this repo can see.** A symbol from another
repo or service, a constant on the other side of an API, a class or file in a different
language, a ticket's stated behaviour, a line number, a version. Nobody renaming that symbol
will ever grep this file, and no compiler, linter or test will notice. So don't reach across
the boundary by name:

- **Describe the observable behaviour, not the mechanism that produces it.** `a suppressed row
  keeps totalProjectedSales` survives the provider renaming its blank-list constant;
  `CPG::BlankedMetrics::RETAILER` does not.
- **Name only what the reader can verify from here** — a symbol in this repo, a wire field, a
  public endpoint or query param. Those the tooling *can* follow.
- **Prefer an assertion to a sentence.** If the fact matters enough to write down, a test or a
  type says it in a way that breaks when it stops being true. Reach for the comment for the
  *why*, which nothing can assert.
- **A duplicated fact is a design smell first.** Two identical definitions explained by a
  comment saying "these must stay in sync" should usually be one definition. Fix the
  duplication and the comment disappears with it.
- **A list of things defined elsewhere is the worst offender**, and it needs no repo boundary
  to rot. "The states already defined in `foo.rb` are a, b, c" goes stale the first time
  someone adds `d`, and it reads as authoritative while doing it. If a reader needs the set,
  tell them how to get it — "grep both files first" — rather than pasting a copy.

**Name the thing that would catch it.** For any comment pointing outside its own file, say what
actually fails if the referent changes — a test, a type, the compiler. "Nothing" means you are
writing a second copy of a fact: drop the reference, or restate it as behaviour the file can
see. Same discipline as counting comments instead of eyeballing density — an answer you can
write down, not a feeling.

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
