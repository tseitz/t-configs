#!/usr/bin/env bash
#
# PostToolUse (matcher: Bash) — capture-only sandbox-denial detector.
#
# Sandbox blocks are ephemeral: by the time post-implementation-reflection runs, the
# agent's working memory has lost the exact command/path/host that got denied, and it
# isn't in git. This hook notices likely sandbox denials as they happen and appends a
# structured line to a per-project log. It NEVER blocks the tool call and NEVER edits
# config — the sandbox-friction skill reads the log later and proposes a fix.
#
# Conservative by design: false positives cost one log line; false negatives lose signal.
# Wired into settings.base.json hooks.PostToolUse under the "Bash" matcher:
#   { "type": "command", "command": "~/.claude/scripts/hooks/capture-sandbox-friction.sh" }

set -euo pipefail

input=$(cat)

# Only inspect Bash results — other tools don't hit the command sandbox the same way.
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null || true)
[ "$tool" = "Bash" ] || exit 0

# Flatten every string in the tool response (object or string) so we can scan stderr/stdout.
resp=$(printf '%s' "$input" | jq -r '[.tool_response] | .. | strings' 2>/dev/null | tr '\n' ' ' || true)

# Conservative sandbox-denial signatures. Keep narrow to avoid noise from ordinary failures.
sig=$(printf '%s' "$resp" | grep -ioE \
  'operation not permitted|read-only file system|could not resolve host|network is unreachable|connection refused|sandbox[ -][a-z]*: deny|blocked by sandbox' \
  | head -1 || true)
[ -n "$sig" ] || exit 0

log="${CLAUDE_PROJECT_DIR:-.}/.claude/sandbox-friction.jsonl"
mkdir -p "$(dirname "$log")" 2>/dev/null || true

printf '%s' "$input" | jq -c --arg sig "$sig" \
  '{ts: (now|todate), signal: $sig, command: (.tool_input.command // ""), cwd: (.cwd // "")}' \
  >> "$log" 2>/dev/null || true

exit 0
