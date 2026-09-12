#!/usr/bin/env node
/**
 * SessionEnd hook - marks a session as cleanly closed.
 *
 * Feeds the "resume sessions after restart" feature (see
 * resume-sessions.js). A clean end means SessionEnd actually fired -
 * the user typed /exit, ran /clear, or logged out. An OS restart kills
 * the process with no chance to run this hook, so a session that was
 * open at restart time never gets marked here. That absence is what
 * resume-sessions.js uses to tell "still open when the Mac rebooted"
 * apart from "the user closed this on purpose".
 */

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const RESUME_DIR = path.join(process.env.HOME || '', '.claude', 'session-resume');
const ENDED_FILE = path.join(RESUME_DIR, 'ended.json');
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function run(raw) {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const sessionId = input.session_id;
    if (sessionId) {
      fs.mkdirSync(RESUME_DIR, { recursive: true });
      let ended = {};
      try {
        ended = JSON.parse(fs.readFileSync(ENDED_FILE, 'utf8'));
      } catch {
        // No file yet, or invalid JSON - start fresh.
      }
      const now = Date.now();
      ended[sessionId] = now;
      for (const [id, endedAt] of Object.entries(ended)) {
        if (now - endedAt > PRUNE_AFTER_MS) delete ended[id];
      }
      fs.writeFileSync(ENDED_FILE, JSON.stringify(ended));
    }
  } catch (err) {
    console.error(`[SessionResumeEnd] Error: ${err.message}`);
  }
  return raw;
}

module.exports = { run };

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    process.stdout.write(run(data));
    process.exit(0);
  });
}
