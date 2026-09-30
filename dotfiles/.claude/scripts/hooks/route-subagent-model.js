#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const KEY_FILE = path.join(os.homedir(), '.config', 'typesafe', 'api_key');
const LOG_FILE = path.join(os.homedir(), '.cache', 'jev-router', 'decisions.jsonl');
const TIMEOUT_MS = 5000;
const MAX_PROMPT_CHARS = 12000;
const MAX_RISK = Number(process.env.JEV_ROUTER_MAX_RISK ?? 0.15);
const PERSONAL_REMOTE = /[:/]tseitz\//i;
const WORK_REMOTE = /[:/](NinthDecimal|ThinkNear)\//i;
const WORK_ROOT = path.join(os.homedir(), 'Code', 'presentation').toLowerCase();
const PATH_IN_TEXT = /(?<![\w.~$/:-])(?:~|\$HOME)?\/[^\s`'"()<>,;:]+/g;

// Named agents pin their own model and forks ignore one, so only generic briefs are routable.
const ROUTABLE_TYPES = new Set([undefined, '', 'general-purpose', 'claude']);

const QUESTION = {
  type: 'choice',
  instructions:
    'A lead engineer is handing the task in `brief.prompt` to a subagent that sees only that text. ' +
    'Pick the cheapest model that can do it well, judged by how much reasoning the brief leaves unresolved, not by how big the task is.',
  criteria: {
    haiku:
      'Mechanical and fully specified: repeat a known change across listed call sites, rename, reformat, or run commands and report output. Nothing to decide.',
    sonnet:
      'Prescriptive implementation: the brief names exact files, signatures, or a pattern to mirror, plus how to verify. Also focused debugging or searching with a clear target.',
    opus:
      'Judgment left open: design, architecture, code review, weighing tradeoffs, ambiguous or underspecified goals, or anything where a wrong call is costly.',
  },
};

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

function pathsIn(text) {
  return (text.match(PATH_IN_TEXT) || []).map(p =>
    p.replace(/^(~|\$HOME)/, os.homedir()),
  );
}

// Returns why this brief must not leave the machine, or null when it may.
// The session must sit in a personal repo (unknown means blocked); a path named in the
// brief is blocked only when it resolves to work, since new files and non-repo paths are normal.
function workReason(cwd, text) {
  if (process.env.T_WORK !== undefined) return 'T_WORK set';
  if (!cwd) return 'no cwd';
  if (isWorkPath(cwd)) return 'session in work repo';
  const remotes = remotesOf(cwd);
  if (!remotes || !PERSONAL_REMOTE.test(remotes.origin || '')) return 'session not in a personal repo';
  if (pathsIn(text).some(isWorkPath)) return 'brief names a work path';
  return null;
}

// Downshift only when the costlier tiers carry almost no probability.
function pickModel(p) {
  const opus = p.opus ?? 1;
  const sonnet = p.sonnet ?? 1;
  if (sonnet + opus < MAX_RISK) return 'haiku';
  if (opus < MAX_RISK) return 'sonnet';
  return null;
}

async function askJev(key, toolInput) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: { brief: { description: String(toolInput.description || ''), prompt: toolInput.prompt } },
      questions: { model: QUESTION },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const answer = (await res.json()).answers?.model;
  if (!answer?.probabilities) throw new Error('response had no model probabilities');
  return answer;
}

function log(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
  } catch (err) {
    console.error(`[jev-router] could not write ${LOG_FILE}: ${err.message}`);
  }
}

function emit(output) {
  process.stdout.write(JSON.stringify(output));
}

function formatOdds(p) {
  return ['haiku', 'sonnet', 'opus'].map(m => `${m} ${Math.round((p[m] ?? 0) * 100)}%`).join(', ');
}

async function main(raw) {
  const input = JSON.parse(raw);
  const toolInput = input.tool_input || {};
  if (toolInput.model || !ROUTABLE_TYPES.has(toolInput.subagent_type)) return emit({});

  const description = String(toolInput.description || '');
  const prompt = String(toolInput.prompt || '');
  const blocked = workReason(input.cwd, `${description}\n${prompt}`);
  if (blocked) {
    log({ skipped: blocked });
    return emit({});
  }

  // The end of a long brief often holds the open questions, so a truncated one would under-rate it.
  if (prompt.length > MAX_PROMPT_CHARS) {
    log({ description, skipped: `brief over ${MAX_PROMPT_CHARS} chars` });
    return emit({});
  }

  const { key, malformed } = readKey();
  if (!key) {
    const why = malformed ? 'TypeSafe key has non-printable characters' : `no TypeSafe key in TYPESAFE_API_KEY or ${KEY_FILE}`;
    return emit({ systemMessage: `jev-router: ${why}; subagent inherits the session model` });
  }

  let answer;
  try {
    answer = await askJev(key, { description, prompt });
  } catch (err) {
    // Only messages this file wrote are safe to echo; a fetch error can quote the auth header.
    const reason = err.name === 'Error' ? err.message : [err.name, err.cause?.code].filter(Boolean).join(' ');
    log({ description, error: reason });
    return emit({ systemMessage: `jev-router: TypeSafe call failed (${reason}); subagent inherits the session model` });
  }

  const { probabilities } = answer;
  const applied = pickModel(probabilities);
  log({ description, choice: answer.choice, confidence: answer.confidence, probabilities, applied });

  const odds = `jev-router: ${formatOdds(probabilities)}`;
  if (!applied) return emit({ systemMessage: `${odds} → inherits session model` });

  emit({
    systemMessage: `${odds} → ${applied}`,
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...toolInput, model: applied } },
  });
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () =>
  main(raw).catch(err => emit({ systemMessage: `jev-router: ${err.name}; subagent inherits the session model` })),
);
