#!/usr/bin/env bash
# Quiet the superpowers plugin's SessionStart context injection while keeping its
# skills, commands, and agents fully usable.
#
# WHY: Claude Code has no per-plugin hook toggle (the only setting is the nuclear
# `disableAllHooks`, which would also kill our own useful hooks). The superpowers
# plugin's SessionStart hook injects a large `<EXTREMELY_IMPORTANT> You have
# superpowers ...` block into every session, which front-runs and overrides our own
# workflow (see rules/common/development-workflow.md). This surgically removes just
# that SessionStart hook from the plugin's installed hooks.json.
#
# NOT update-safe: `/plugin update` replaces the whole plugin directory, restoring the
# hook. RE-RUN THIS SCRIPT after updating superpowers. It is idempotent and backs up
# the original hooks.json (once) alongside it as hooks.json.orig.
set -euo pipefail

shopt -s nullglob
found=0
for hooks_json in "$HOME"/.claude/plugins/cache/*/superpowers/*/hooks/hooks.json; do
  found=1
  if ! grep -q '"SessionStart"' "$hooks_json"; then
    echo "already quiet: $hooks_json"
    continue
  fi
  cp -n "$hooks_json" "$hooks_json.orig"   # back up original once
  tmp="$(mktemp)"
  jq 'del(.hooks.SessionStart)' "$hooks_json" >"$tmp" && mv "$tmp" "$hooks_json"
  echo "quieted SessionStart hook: $hooks_json"
done

if [ "$found" -eq 0 ]; then
  echo "no superpowers plugin found under ~/.claude/plugins/cache — nothing to do" >&2
fi
exit 0
