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
# Wired into settings.base.json hooks.PostToolUse under the "Bash" matcher:
#   { "type": "command", "command": "~/.claude/scripts/hooks/capture-sandbox-friction.sh" }
#
# Reads stderr only, NOT stdout. Scanning both made the log ~87% false positives: any command
# that *printed* a denial — `cat` on a log file, `tail` on captured build output — looked exactly
# like a command that *hit* one. A real denial always goes to stderr, so precision costs almost
# no recall. The exception is a command that merges with `2>&1`, which this cannot see; that is
# the deliberate trade, because a log nobody trusts is read by nobody.
#
# Exception: the harness's `deny network-outbound <host>` / `deny file-write… <path>` lines are
# scanned in every field — the only signal that survives `2>&1`. Anchored to line start: the
# harness writes them that way, while a command that merely prints one (a trace, a `cat` of
# this log) has it mid-line.

set -euo pipefail

input=$(cat)

# Only inspect Bash results — other tools don't hit the command sandbox the same way.
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null || true)
[ "$tool" = "Bash" ] || exit 0

# stderr only — see the header. Falls back to the whole response when the shape has no stderr
# key, so a future tool-response change degrades to the old behaviour instead of going silent.
resp=$(printf '%s' "$input" | jq -r '
  if (.tool_response | type) == "object" and (.tool_response | has("stderr"))
  then (.tool_response.stderr // empty)
  else ([.tool_response] | .. | strings)
  end' 2>/dev/null | tr '\n' ' ' || true)

# Conservative sandbox-denial signatures. Keep narrow to avoid noise from ordinary failures.
sig=$(printf '%s' "$resp" | grep -ioE \
  'operation not permitted|read-only file system|could not resolve host|network is unreachable|connection refused|sandbox[ -][a-z]*: deny|blocked by sandbox' \
  | head -1 || true)
if [ -z "$sig" ]; then
  sig=$(printf '%s' "$input" | jq -r '[.tool_response] | .. | strings' 2>/dev/null \
    | grep -oE '^deny (network-outbound|file-[a-z-]+) [^ ]+' | head -1 || true)
fi
[ -n "$sig" ] || exit 0

log="${CLAUDE_PROJECT_DIR:-.}/.claude/sandbox-friction.jsonl"
mkdir -p "$(dirname "$log")" 2>/dev/null || true

printf '%s' "$input" | jq -c --arg sig "$sig" \
  '{ts: (now|todate), signal: $sig, command: (.tool_input.command // ""), cwd: (.cwd // "")}' \
  >> "$log" 2>/dev/null || true

exit 0
