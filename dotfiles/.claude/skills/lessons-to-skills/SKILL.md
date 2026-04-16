---
name: lessons-to-skill
description: Use when the lessons directory has accumulated multiple related entries on a topic and they should be audited, discussed, and consolidated into a canonical skill
---

# Lessons to Skill

Audit related lesson files, identify stale/redundant/contradictory content, and consolidate
into a single canonical skill through collaborative discussion with the user.

## When to Use

- Multiple lesson files exist on the same topic (3+)
- Lesson files reference each other or overlap significantly
- You notice a lesson contains claims that were corrected in a later lesson
- The user says "consolidate", "clean up lessons", or "make a skill from these lessons"
- Session-start reveals a topic cluster that's getting unwieldy

## When NOT to Use

- A single lesson on an isolated topic — leave it as a lesson
- The topic is too narrow for a reusable skill (one-off fix, specific bug)
- Lessons are still actively being written (topic is in flux)

## Process

### Phase 1: Audit

1. Read `.claude/LESSONS.md` — identify the topic cluster
2. Read ALL lesson files in the cluster in parallel
3. Read any memory entries, rules, or code references related to the topic
4. Build an inventory:

```
| Lesson file | Key claims | Stale? | Contradicts? |
|------------|-----------|--------|-------------|
| ...        | ...       | ...    | ...         |
```

5. **Present the inventory to the user** — do NOT proceed to writing without discussion.
   Ask: "Here's what I found. Which of these are still accurate? Anything missing?"

### Phase 2: Research (if needed)

- Search the codebase to verify lesson claims against current code
- Do targeted web research to fill gaps or validate domain knowledge
- Check if any "known bugs" listed in lessons have already been fixed
- **Report findings to the user** before drafting

### Phase 3: Draft Collaboratively

Write the skill following the project's skill format:

```yaml
---
name: topic-name
description: Use when [triggering conditions — no workflow summary]
---
```

Key principles for the draft:

- **Correct stale claims** — don't copy-paste from lessons. Verify each claim.
- **Preserve hard-won failures** — the "Wrong Models / Do Not Revisit" section is
  often the most valuable part. Include WHY each approach failed.
- **Discuss with the user** — present the draft section by section. Domain knowledge
  corrections (physics, geometry, manufacturing) come from the user, not from the lessons.
- **Add code references** — file paths and function names for key implementations.
- **Include fabrication/practical constraints** if the topic bridges simulation and
  physical builds.

### Phase 4: Wire Up

1. Add a signal row to `.claude/skills/session-start/SKILL.md` so the skill auto-loads
   when the topic comes up in future sessions
2. Update `.claude/LESSONS.md` — replace individual entries with a single pointer to
   the new skill

### Phase 5: Clean Up

1. **Delete the source lesson files** — they are now stale duplicates
2. **Strip topic-specific sections from shared lesson files** (e.g., fitness-scoring.md)
   and add a one-line redirect to the skill
3. **Update the skill's own code reference section** to remove pointers to deleted lessons
4. **Commit and push** — two commits recommended:
   - First: the new skill
   - Second: the lesson cleanup (so the skill exists before lessons are removed)

## Anti-Patterns

| Mistake | Why it's wrong |
|---------|---------------|
| Copy-paste lessons into skill without verification | Lessons contain stale claims — the whole point is to correct them |
| Skip user discussion, just merge everything | Domain corrections come from the user; you will propagate errors |
| Keep lessons "as backup" after creating skill | Creates contradictory sources; future agents read the wrong one |
| Create the skill but don't wire into session-start | Skill won't be discovered; agents will keep reading scattered lessons |
| Consolidate lessons that are still in flux | Wait until the topic stabilizes before promoting to a skill |

## Checklist

- [ ] All lesson files in cluster identified and read
- [ ] Inventory presented to user with stale/contradiction flags
- [ ] Code verified — lesson claims checked against current codebase
- [ ] Draft reviewed section-by-section with user
- [ ] Skill wired into session-start
- [ ] LESSONS.md updated with skill pointer
- [ ] Source lesson files deleted
- [ ] Shared lesson files trimmed (redirects added)
- [ ] Committed and pushed
