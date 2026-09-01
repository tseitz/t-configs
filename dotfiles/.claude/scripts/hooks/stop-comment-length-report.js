#!/usr/bin/env node
/**
 * Stop Hook: report verbose comment blocks written during this response
 *
 * Reads what post-edit-comment-length.js accumulated, prints one summary, and
 * clears the file. Reporting at Stop rather than per-edit is the point: a nudge
 * that arrives mid-edit becomes noise you learn to skip, while one that arrives
 * as the work is handed back lands when re-reading is natural anyway.
 *
 * This reports and does not block. The number is the whole intervention — it
 * prescribes nothing, because the judgment of whether a given comment earns its
 * length is not something a line count can make.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const MAX_ROWS_SHOWN = 8;

function getAccumFile() {
  const raw =
    process.env.CLAUDE_SESSION_ID ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const sessionId = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `claude-comment-length-${sessionId}.txt`);
}

function parseAccumulator(raw) {
  const seen = new Set();
  const rows = [];
  for (const line of raw.split('\n')) {
    if (!line.trim() || seen.has(line)) continue;
    seen.add(line);
    const [file, at, comment, code] = line.split('\t');
    if (file && at) rows.push({ file, at, comment: Number(comment), code: Number(code) });
  }
  return rows;
}

function main() {
  const accumFile = getAccumFile();
  if (!fs.existsSync(accumFile)) return;

  const rows = parseAccumulator(fs.readFileSync(accumFile, 'utf8'));
  fs.rmSync(accumFile, { force: true });
  if (rows.length === 0) return;

  const lines = rows
    .slice(0, MAX_ROWS_SHOWN)
    .map(r => `  ${r.file}:${r.at}  ${r.comment} comment lines over ${r.code} of code`);
  if (rows.length > MAX_ROWS_SHOWN) lines.push(`  …and ${rows.length - MAX_ROWS_SHOWN} more`);

  process.stderr.write(
    `[comments] ${rows.length} long block${rows.length === 1 ? '' : 's'} written this response:\n` +
      lines.join('\n') +
      '\nBe as brief as the point allows. Cut, or move the reasoning to the PR or commit body.\n'
  );
}

function run(rawInput) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[Hook] stop-comment-length-report error: ${err.message}\n`);
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

module.exports = { run, parseAccumulator, getAccumFile };
