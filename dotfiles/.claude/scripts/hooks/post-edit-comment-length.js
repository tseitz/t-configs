#!/usr/bin/env node
/**
 * PostToolUse Hook: flag verbose comment blocks as they are written
 *
 * Records comment blocks that are long relative to the code they introduce, so
 * stop-comment-length-report.js can surface them once at the end of the response
 * rather than interrupting mid-edit.
 *
 * Length is the only thing measured here, deliberately. It is a local property —
 * visible in the text being written, with no need to read sibling files — which
 * makes it the one part of the comment rule that can be checked at write time.
 * Density against siblings and whether a comment is a trap or a story both need
 * the assembled diff; those belong to post-implementation-reflection.
 *
 * appendFileSync keeps concurrent hook processes from overwriting each other.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

// Four is where it turned over in practice: reviewing a day of comments, every block of three
// lines or fewer survived review and every block of four or more got cut or rewritten. A ratio
// against the following code was tried first and abandoned — a two-line comment introducing a
// one-line statement is the most ordinary shape there is, so the ratio fired constantly on
// comments that were correct.
const ABSOLUTE_LINES = 4;
// Skip the first lines of a file: module headers and licence blocks are legitimately long.
const HEADER_GRACE_LINES = 3;

const COMMENT_RE = /^\s*(\/\/|#|\*|\/\*)/;
// A structured docstring is a different artifact from prose — its length comes from the
// signature it documents, not from a decision to explain more.
const TAG_RE = /^\s*[*#/]*\s*@\w+/;
const BLANK_RE = /^\s*$/;
// Markdown and friends are prose by definition; config formats carry no code to compare against.
const SKIP_EXT = /\.(md|mdx|txt|json|ya?ml|lock|csv)$/i;

function getAccumFile() {
  const raw =
    process.env.CLAUDE_SESSION_ID ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const sessionId = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `claude-comment-length-${sessionId}.txt`);
}

/**
 * Find comment runs in added text and measure each against the code it introduces.
 *
 * @param {string} text - The text added by this edit
 * @param {boolean} isWholeFile - True for Write. An Edit's new_string is a fragment, so a block
 *   at its start is mid-file, not a header, and must not get the header grace.
 * @returns {Array<{line: number, comment: number, code: number}>}
 */
function findVerboseBlocks(text, isWholeFile = false) {
  const lines = text.split('\n');
  const findings = [];
  let i = 0;

  while (i < lines.length) {
    if (!COMMENT_RE.test(lines[i])) {
      i += 1;
      continue;
    }

    const start = i;
    while (i < lines.length && COMMENT_RE.test(lines[i])) i += 1;
    const commentLines = i - start;

    // Count the code this block introduces: up to the next blank line or comment.
    let code = 0;
    let j = i;
    while (j < lines.length && !BLANK_RE.test(lines[j]) && !COMMENT_RE.test(lines[j])) {
      code += 1;
      j += 1;
    }

    const tagLines = lines.slice(start, i).filter(l => TAG_RE.test(l)).length;
    const isDocstring = tagLines * 2 >= commentLines;
    const isFileHeader = isWholeFile && start < HEADER_GRACE_LINES;
    const tooLong = commentLines >= ABSOLUTE_LINES;
    if (!isFileHeader && !isDocstring && tooLong) {
      findings.push({ line: start + 1, comment: commentLines, code });
    }
  }

  return findings;
}

function record(filePath, text, isWholeFile) {
  if (!filePath || !text || SKIP_EXT.test(filePath)) return;
  const findings = findVerboseBlocks(text, isWholeFile);
  if (findings.length === 0) return;

  const rows = findings
    .map(f => `${filePath}\t${f.line}\t${f.comment}\t${f.code}`)
    .join('\n');
  fs.appendFileSync(getAccumFile(), rows + '\n', 'utf8');
}

/**
 * @param {string} rawInput - Raw JSON string from stdin
 * @returns {string} The original input (pass-through)
 */
function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const ti = input.tool_input || {};
    // Write sends `content`; Edit sends `new_string`; MultiEdit sends an edits array.
    record(ti.file_path, ti.content, true);
    record(ti.file_path, ti.new_string, false);
    if (Array.isArray(ti.edits)) {
      for (const edit of ti.edits) record(edit?.file_path || ti.file_path, edit?.new_string, false);
    }
  } catch {
    // Invalid input — pass through untouched.
  }
  return rawInput;
}

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

module.exports = { run, findVerboseBlocks, getAccumFile };
