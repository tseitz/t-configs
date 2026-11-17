#!/bin/sh
root="${CLAUDE_PROJECT_DIR:-$PWD}"
pkg="$root/node_modules/typescript/package.json"

if [ ! -f "$pkg" ]; then
  # Feeds plugin.json's tsserver.fallbackPath. Unique name so mise's own tsserver launcher can't shadow it on PATH.
  global_ts=$(cd "$HOME" && mise where npm:typescript 2>/dev/null)
  if [ -n "$global_ts" ]; then
    link_dir="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}/ts-lsp}/bin"
    mkdir -p "$link_dir" &&
      ln -sf "$global_ts/node_modules/typescript/bin/tsserver" "$link_dir/ts-lsp-fallback-tsserver" &&
      export PATH="$link_dir:$PATH"
  fi
fi

cd "$root" || exit 1
major=$(sed -n 's/^ *"version": *"\([0-9][0-9]*\)\..*/\1/p' "$pkg" 2>/dev/null | head -n 1)

# TS 7+ ships no tsserver.js for typescript-language-server to wrap; its tsc is the LSP server.
if [ -n "$major" ] && [ "$major" -ge 7 ]; then
  exec "$root/node_modules/typescript/bin/tsc" --lsp --stdio
fi
exec typescript-language-server --stdio
