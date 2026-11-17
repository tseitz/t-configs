#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findEnvrc(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const candidate = path.join(d, '.envrc');
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(d) === d) return null;
  }
}

// Load via CLAUDE_ENV_FILE, never a PreToolUse rewrite: auto mode bounces rewritten commands.
function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const event = input.hook_event_name;
  const dir = event === 'CwdChanged' ? input.new_cwd : input.cwd;
  const envrc = findEnvrc(dir);
  const envFile = process.env.CLAUDE_ENV_FILE;

  if (envrc && envFile) {
    const exported = execFileSync('direnv', ['export', 'bash'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    if (exported.trim()) fs.appendFileSync(envFile, `${exported.trimEnd()}\n`);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: event, watchPaths: envrc ? [envrc] : [] },
    }),
  );
}

main();
