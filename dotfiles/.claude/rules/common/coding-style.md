# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Comments — write them in plain language

Code can be as dense as the problem needs. **Comments cannot.** A comment exists to be
understood by a tired person at 2am, so it gets held to a plainer standard than the code
around it.

Write comments in the spirit of ASD-STE100 Simplified Technical English:

- **One idea per sentence.** Short sentences. Active voice.
- **Small words.** If a big word or a domain term is unavoidable, define it right there in
  the same comment — don't assume the reader knows the jargon.
- **Say WHY, not WHAT.** The code already says what it does. The comment carries the reason,
  the invariant, or the trap.
- **No cleverness.** No puns, no in-jokes, no allusions. They stop being funny and start
  being confusing on the first read by someone else.
- **Spell out the acronym on first use** in a given file — including domain acronyms that
  feel obvious to whoever is writing them.

This applies to inline comments, block comments, docstrings, JSDoc/TSDoc, module headers,
and TODO notes. It does NOT apply to the code — variable names, structure, and idiom still
follow the language's conventions and the file's existing style.

**This rule governs how a comment READS, not whether it EXISTS.** Two rules still decide
whether to write one at all, and they win on that question:

- [pr-descriptions.md](pr-descriptions.md#code-comments-vs-diff-commentary) — the routing
  test. Diff commentary goes on the PR, not in the repo. Plain language does not make a
  comment worth keeping.
- **Match the file's comment density.** Don't sprinkle new explanatory comments through a
  file that is deliberately sparse. Plain-language applies to comments you write; it is not
  a licence to write more of them.

Don't rewrite existing comments just to plain-ify them. Improve them when you're already
editing that code for another reason.

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Comments are in plain language (short sentences, jargon defined, WHY not WHAT)
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
