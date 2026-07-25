# Model Route Command

Recommend the best model tier for the current task by complexity and budget.

## Usage

`/model-route [task-description] [--budget low|med|high]`

## Routing Heuristic

**Ask the mode question FIRST — tier is only a choice for delegated work.**

1. **Inline or delegated?** Inline work runs on the session model, full stop; there is no tier
   to pick, and proposing one implies a mid-session model switch that busts the prompt cache.
   Delegate only for parallel fan-out, context isolation, or a genuine tier mismatch.
2. **Can the brief be written cold?** A subagent gets the system prompt, CLAUDE.md, and the
   prompt — nothing from the conversation. If a self-contained prescriptive brief (exact paths,
   signature, pattern to mirror, verify command) can't be written, the task can't be downshifted.
   Consider splitting: scout inline, delegate the mechanical residual.
3. **Is a named agent already the answer?** Agents in `~/.claude/agents/` pin their own model
   (`architect`/`planner` → Opus, the rest → Sonnet). If one covers the task, name it and stop.
4. **Only then, pick the tier:**
   - `haiku`: deterministic, low-risk, fully-specified mechanical changes
   - `sonnet`: implementation, refactors, integration, debugging
   - `opus`: architecture, deep review, ambiguous requirements
   - `fable`: hardest reasoning, above Opus

## Required Output

- **mode** (inline vs. delegated) — and if delegated, why delegation pays
- recommended model **and effort** (`low`→`max`; default `high`) — omit model for inline rows,
  which inherit the session model
- cold-brief verdict: can this be specified cold? if not, what to scout inline first
- confidence level
- why this fits
- fallback model if the first attempt fails

## Arguments

$ARGUMENTS:
- `[task-description]` optional free-text
- `--budget low|med|high` optional
