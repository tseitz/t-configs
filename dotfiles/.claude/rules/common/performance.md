# Performance Optimization

## Model Selection Strategy

This table is the *what* — which model to name once you've decided to route. For the *when*
(session model vs. delegated task, and the cold-brief gate on downshifting), see
[development-workflow.md](development-workflow.md) §3, which is authoritative on routing.

| Model | API ID | Use for |
|-------|--------|---------|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | Mechanical, fully-specified work; high-frequency invocation; parallel fan-out workers |
| **Sonnet 5** | `claude-sonnet-5` | Implementation, refactors, integration, debugging, multi-file coordination |
| **Opus 5** | `claude-opus-5` | Architecture, ambiguous requirements, deep review and research |
| **Fable 5** | `claude-fable-5` | Hardest reasoning — the tier above Opus |

Cheaper models are significantly faster and cost less, so downshift wherever the task allows —
but the gate is whether the task can be *specified cold*, not a gut feel about difficulty.
Escalate only when depth of reasoning is the actual bottleneck.

**Effort (`low`→`max`) is a second, independent knob** and a large cost/latency lever on top of
model choice. Default effort: `high`. Set both together, never one implicitly.

## Context Window Management

Avoid the last 20% of the context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks (fine to run anywhere):
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
