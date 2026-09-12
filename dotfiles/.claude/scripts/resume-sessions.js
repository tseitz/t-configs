#!/usr/bin/env node
/**
 * Reopens the interactive Claude Code sessions that were still running
 * when the Mac last shut down, each in its own iTerm tab.
 *
 * There is no public "list of open sessions" API, so this reads Claude
 * Code's own per-process session files under ~/.claude/sessions/*.json
 * (undocumented, but it is the only place the live display name lives -
 * SessionStart/SessionEnd hook payloads do not carry it). A session
 * counts as "was open at shutdown" when its file was updated since the
 * last time this script ran AND session-resume-end.js never marked it
 * as cleanly closed. macOS-only; no-ops anywhere else or without iTerm.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = process.env.HOME || os.homedir();
const SESSIONS_DIR = path.join(HOME, '.claude', 'sessions');
const RESUME_DIR = path.join(HOME, '.claude', 'session-resume');
const ENDED_FILE = path.join(RESUME_DIR, 'ended.json');
const LAST_RUN_FILE = path.join(RESUME_DIR, 'last-run.json');
const LAUNCH_SCRIPTS_DIR = path.join(RESUME_DIR, 'launch');
const LOG_FILE = path.join(RESUME_DIR, 'resume-log.txt');
const DEFAULT_LOOKBACK_MS = 6 * 60 * 60 * 1000;
// launchd does not run login-shell startup files, so PATH lookups for
// mise-managed tools fail there even though they work in a real terminal.
const CLAUDE_BIN = path.join(HOME, '.local', 'bin', 'claude');

function log(line) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function findSessionsToResume() {
  const ended = readJson(ENDED_FILE, {});
  const lastRun = readJson(LAST_RUN_FILE, null);
  const sinceMs = lastRun && lastRun.ts ? lastRun.ts : Date.now() - DEFAULT_LOOKBACK_MS;

  const byId = new Map();
  let files = [];
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }

  for (const file of files) {
    const info = readJson(path.join(SESSIONS_DIR, file), null);
    if (!info || !info.sessionId || !info.cwd) continue;
    if (info.kind !== 'interactive' || info.entrypoint !== 'cli') continue;
    if (!info.updatedAt || info.updatedAt < sinceMs) continue;
    if (ended[info.sessionId]) continue;

    const existing = byId.get(info.sessionId);
    if (!existing || info.updatedAt > existing.updatedAt) byId.set(info.sessionId, info);
  }

  return [...byId.values()];
}

function writeLaunchScript(session) {
  fs.mkdirSync(LAUNCH_SCRIPTS_DIR, { recursive: true });
  const scriptPath = path.join(LAUNCH_SCRIPTS_DIR, `${session.sessionId}.sh`);
  const name = session.name || session.sessionId;
  const contents = `#!/bin/zsh\ncd ${shellSingleQuote(session.cwd)} || exit 1\nexec ${shellSingleQuote(CLAUDE_BIN)} --resume ${shellSingleQuote(session.sessionId)} --name ${shellSingleQuote(name)}\n`;
  fs.writeFileSync(scriptPath, contents, { mode: 0o755 });
  return scriptPath;
}

function buildAppleScript(scriptPaths) {
  const lines = ['tell application "iTerm2"', '  activate'];
  scriptPaths.forEach((scriptPath, index) => {
    const command = `zsh ${shellSingleQuote(scriptPath)}`;
    const asString = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    if (index === 0) {
      lines.push('  set w to (create window with default profile)');
      lines.push(`  tell current session of w to write text "${asString}"`);
    } else {
      lines.push('  tell w to set t to (create tab with default profile)');
      lines.push(`  tell current session of t to write text "${asString}"`);
    }
  });
  lines.push('end tell');
  return lines.join('\n');
}

function main() {
  if (process.platform !== 'darwin') return;
  if (!fs.existsSync('/Applications/iTerm.app')) return;

  fs.mkdirSync(RESUME_DIR, { recursive: true });
  const sessions = findSessionsToResume();

  if (sessions.length === 0) {
    log('No sessions to resume.');
  } else {
    const scriptPaths = sessions.map(writeLaunchScript);
    const appleScript = buildAppleScript(scriptPaths);
    const appleScriptPath = path.join(RESUME_DIR, 'launch.applescript');
    fs.writeFileSync(appleScriptPath, appleScript);
    execFileSync('osascript', [appleScriptPath]);
    log(`Resumed ${sessions.length} session(s): ${sessions.map(s => `${s.name} (${s.cwd})`).join(', ')}`);
  }

  fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ ts: Date.now() }));
}

main();
