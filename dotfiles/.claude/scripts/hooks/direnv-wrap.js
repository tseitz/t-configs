#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// The sandbox matches sandbox.excludedCommands against the command string AFTER this hook
// rewrites it, so a wrapped command can never match an exclusion. Skip wrapping anything an
// exclusion names, read live from every settings file, so no second list exists to drift.
function settingsFiles(projectDir) {
  const home = path.join(os.homedir(), '.claude');
  const files = [path.join(home, 'settings.json'), path.join(home, 'settings.local.json')];
  // A --settings file is invisible to hooks, so review-prs.js names it in the env.
  if (process.env.REVIEW_SANDBOX_SETTINGS) files.push(process.env.REVIEW_SANDBOX_SETTINGS);
  if (projectDir) {
    files.push(
      path.join(projectDir, '.claude', 'settings.json'),
      path.join(projectDir, '.claude', 'settings.local.json'),
    );
  }
  return files;
}

function readExclusions(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return JSON.parse(text).sandbox?.excludedCommands ?? [];
}

// Bash permission-rule glob: "uv *" matches bare "uv" too; any other "*" is a wildcard.
function globToRegex(glob) {
  const optionalArgs = glob.endsWith(' *');
  const body = optionalArgs ? glob.slice(0, -2) : glob;
  const escaped = body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}${optionalArgs ? '( .*)?' : ''}$`, 's');
}

function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const command = input.tool_input.command;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  const excluded = settingsFiles(projectDir).flatMap(readExclusions).map(globToRegex);

  if (excluded.some((re) => re.test(command.trim()))) {
    process.stdout.write('{}');
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...input.tool_input,
          command: `eval "$(direnv export bash 2>/dev/null)" && ${command}`,
        },
      },
    }),
  );
}

main();
