# Performance Optimization

## Model Selection Strategy

Choose the right model for the task. Cheaper models are significantly faster and cost less — only escalate when the task genuinely requires it.

| Model | API ID | Use for |
|-------|--------|---------|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | Lightweight agents, frequent invocation, worker agents in multi-agent systems |
| **Sonnet 4.6** | `claude-sonnet-4-6` | Main development work, complex coding tasks, orchestrating multi-agent workflows |
| **Opus 4.6** | `claude-opus-4-6` | Complex architectural decisions, maximum reasoning, deep research and analysis |

**Default to Sonnet 4.6.** Drop to Haiku for high-frequency or simple tasks. Escalate to Opus only when depth of reasoning is the bottleneck.

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
