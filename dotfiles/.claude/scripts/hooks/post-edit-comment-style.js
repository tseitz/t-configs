#!/usr/bin/env node
/**
 * PostToolUse Hook: restate the comment rule at the moment a comment is written
 *
 * coding-style.md is read once at session start and then buried. Writing code is
 * the point where it is least likely to be recalled, so the rule is re-delivered
 * here instead — attached to the edit that added a comment.
 *
 * PostToolUse rather than PreToolUse because only PostToolUse honours
 * hookSpecificOutput.additionalContext; PreToolUse can allow or deny and nothing
 * else, so a reminder there would have to block the edit to be heard.
 *
 * Fires once per file per session. Repeating it on every edit to the same file
 * trains the reader to skip it, which is the failure this hook exists to fix.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

const COMMENT_RE = /^\s*(\/\/|#|\*|\/\*)/;
// Prose formats are comments end to end; config formats have no code to weigh against.
const SKIP_EXT = /\.(md|mdx|txt|json|ya?ml|lock|csv)$/i;

const REMINDER = [
  'Comment rule (coding-style.md), applied to the comment you just wrote:',
  '- Trap, not story. Invariant, footgun, load-bearing check → keep. History, restating the code, a name from another repo → cut, or move it to the PR.',
  '- Density: match the sibling files. New file → the directory median, often zero.',
  '- Terse. Fragments fine, grammar optional, as long as the point lands.',
  'Revise or delete it now if it fails any of those. Pre-existing comments are out of scope.',
].join('\n');

function getSeenFile() {
  const raw =
    process.env.CLAUDE_SESSION_ID ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const sessionId = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `claude-comment-style-${sessionId}.txt`);
}

function addsComment(text) {
  if (!text) return false;
  return text.split('\n').some(line => COMMENT_RE.test(line));
}

function alreadyWarned(filePath) {
  const seenFile = getSeenFile();
  let seen = '';
  try {
    seen = fs.readFileSync(seenFile, 'utf8');
  } catch {
    // No file yet — first comment of the session.
  }
  if (seen.split('\n').includes(filePath)) return true;
  fs.appendFileSync(seenFile, filePath + '\n', 'utf8');
  return false;
}

/**
 * @param {string} rawInput - Raw JSON string from stdin
 * @returns {string} Hook JSON to write to stdout, or '' to stay silent
 */
function run(rawInput) {
  let input;
  try {
    input = JSON.parse(rawInput);
  } catch {
    return '';
  }

  const ti = input.tool_input || {};
  const filePath = ti.file_path || ti.file || '';
  if (!filePath || SKIP_EXT.test(filePath)) return '';

  // Write sends `content`; Edit sends `new_string`; MultiEdit sends an edits array.
  const texts = [ti.content, ti.new_string];
  if (Array.isArray(ti.edits)) texts.push(...ti.edits.map(e => e && e.new_string));
  if (!texts.some(addsComment)) return '';

  if (alreadyWarned(filePath)) return '';

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `${REMINDER}\n(file: ${filePath})`,
    },
  });
}

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    const out = run(data);
    // No process.exit here. stdout is a pipe, so writes are async and exiting
    // truncates them — the hook goes silent with a success code.
    if (out) process.stdout.write(out);
  });
}

module.exports = { run, addsComment, getSeenFile };
