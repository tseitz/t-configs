'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const KEY_FILE = path.join(os.homedir(), '.config', 'typesafe', 'api_key');
const TIMEOUT_MS = 5000;
const PERSONAL_REMOTE = /[:/]tseitz\//i;
const WORK_REMOTE = /[:/](NinthDecimal|ThinkNear)\//i;
const WORK_ROOT = path.join(os.homedir(), 'Code', 'presentation').toLowerCase();
const PATH_IN_TEXT = /(?<![\w.~$/:-])(?:~|\$HOME|\$\{HOME\}|\.\.?)?\/[^\s`'"()<>,;:]+/g;
const MAX_PATHS = 20;

// Printable ASCII only: fetch echoes a bad header value, key included, in its error text.
function readKey() {
  let key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    try {
      key = fs.readFileSync(KEY_FILE, 'utf8');
    } catch {
      return { key: '' };
    }
  }
  key = key.trim();
  return /^[\x21-\x7e]+$/.test(key) ? { key } : { key: '', malformed: true };
}

function missingKeyReason(malformed) {
  return malformed ? 'TypeSafe key has non-printable characters' : `no TypeSafe key in TYPESAFE_API_KEY or ${KEY_FILE}`;
}

// Map of remote name -> url, or null outside a repo.
function remotesOf(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'config', '--get-regexp', '^remote\\..*\\.url$'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    });
    return Object.fromEntries(
      out.trim().split('\n').map(line => {
        const [k, url] = line.split(/\s+/);
        return [k.replace(/^remote\.|\.url$/g, ''), url];
      }),
    );
  } catch {
    return null;
  }
}

function realOrNearestParent(p) {
  for (let dir = p; ; dir = path.dirname(dir)) {
    try {
      return fs.realpathSync(dir);
    } catch {
      if (dir === path.dirname(dir)) return dir;
    }
  }
}

function isWorkPath(p) {
  const real = realOrNearestParent(p);
  const underRoot = q => (path.resolve(q) + '/').toLowerCase().startsWith(WORK_ROOT + '/');
  if (underRoot(p) || underRoot(real)) return true;
  return Object.values(remotesOf(real) || {}).some(url => WORK_REMOTE.test(url));
}

function pathsIn(text, cwd) {
  const found = (text.match(PATH_IN_TEXT) || []).map(p =>
    path.resolve(cwd, p.replace(/^(~|\$HOME|\$\{HOME\})/, os.homedir())),
  );
  return [...new Set(found)];
}

// Returns why this text must not leave the machine, or null when it may.
// The session must sit in a personal repo (unknown means blocked); a path named in the
// text is blocked only when it resolves to work, since new files and non-repo paths are normal.
function workReason(cwd, text) {
  if (process.env.T_WORK !== undefined) return 'T_WORK set';
  if (!cwd) return 'no cwd';
  if (isWorkPath(cwd)) return 'session in work repo';
  const remotes = remotesOf(cwd);
  if (!remotes || !PERSONAL_REMOTE.test(remotes.origin || '')) return 'session not in a personal repo';
  const paths = pathsIn(text, cwd);
  // Each check is synchronous git; unbounded, it can outlast the caller's hook timeout.
  if (paths.length > MAX_PATHS) return `text names over ${MAX_PATHS} paths`;
  if (paths.some(isWorkPath)) return 'text names a work path';
  return null;
}

async function askJev(key, state, questions) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { answers } = await res.json();
  for (const name of Object.keys(questions)) {
    if (!answers?.[name]?.probabilities) throw new Error(`response had no ${name} probabilities`);
  }
  return answers;
}

// Only messages this module wrote are safe to echo; a fetch error can quote the auth header.
function safeErrorReason(err) {
  return err.name === 'Error' ? err.message : [err.name, err.cause?.code].filter(Boolean).join(' ');
}

function appendLog(file, tag, entry) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
  } catch (err) {
    console.error(`[${tag}] could not write ${file}: ${err.message}`);
  }
}

module.exports = { readKey, missingKeyReason, workReason, askJev, safeErrorReason, appendLog };
