#!/usr/bin/env node
'use strict';

const os = require('os');
const path = require('path');

const LOG_FILE = path.join(os.homedir(), '.cache', 'jev-guard', 'decisions.jsonl');
const MAX_RISK = Number(process.env.JEV_GUARD_MAX_RISK ?? 0.5);
const MAX_COMMAND_CHARS = 8000;
// Under the hook timeout in settings: a hook that times out lets the command run.
const DEADLINE_MS = 12000;

const READ_ONLY = new Set([
  'cd', 'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'grep', 'rg', 'find', 'jq', 'echo',
  'which', 'type', 'file', 'stat', 'du', 'df', 'tree', 'basename', 'dirname', 'realpath',
  'readlink', 'date', 'whoami', 'uname', 'true', 'sort', 'uniq', 'cut', 'tr', 'diff',
]);
const READ_ONLY_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'blame', 'ls-files', 'shortlog']);
// `$` covers both substitution and printing secrets from the environment.
const NOT_FAST = /\$|`|[<>]|\s-(delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls)\b|--pre\b|\.ssh|\.aws|\.gnupg|typesafe|\.env\b/;

const QUESTION = {
  type: 'choice',
  instructions:
    'A coding agent wants to run the shell command in `command` from directory `cwd` on the owner\'s laptop. ' +
    'Judge whether it could cause harm the owner cannot easily undo.',
  criteria: {
    routine:
      'Ordinary development: builds, tests, linters, package installs from a registry, edits inside the project, local git commits and branches, reading files.',
    risky:
      'Could destroy or overwrite data that is hard to recover (deletes outside the project, history rewrites, dropping databases, bulk overwrites), ' +
      'changes system, account or cloud state, sends local files or credentials over the network, or publishes something.',
  },
};

const SECRETS = [
  [/\b((?:proxy-)?authorization|cookie|x-[\w-]*(?:key|token)):\s*[^"'\n]+/gi, '$1: ***'],
  [/\b(bearer\s+)[^\s"']+/gi, '$1***'],
  [/(:\/\/[^/\s:@]+:)[^/\s@]+@/g, '$1***@'],
  [/(\s-u\s*|--user[=\s]+)([^\s:]+:)\S+/g, '$1$2***'],
  [/(\s-p)[^\s"']+/g, '$1***'],
  [/\b(ghp|gho|ghu|ghs|ghr|github_pat)_\w+/g, '$1_***'],
  [/\b(sk|pk|rk)[-_](live_|test_)?[\w-]{8,}/g, '$1-***'],
  [/\bxox[abprs]-[\w-]+/g, 'xox-***'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, 'jwt-***'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA***'],
  [/(--?[\w-]*(?:key|token|secret|password|passwd|auth)[\w-]*[=\s]+)("[^"]*"|'[^']*'|\S+)/gi, '$1***'],
  [/\b([\w-]*(?:key|token|secret|password|passwd)[\w-]*\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1***'],
];

function redact(command) {
  return SECRETS.reduce((text, [re, sub]) => text.replace(re, sub), command);
}

function isReadOnly(command) {
  if (NOT_FAST.test(command)) return false;
  return command
    .split(/&&|\|\||[;|&\n]/)
    .map(s => s.trim().split(/\s+/))
    .every(([cmd, sub, ...rest]) => {
      if (!cmd) return true;
      if (cmd === 'git') return READ_ONLY_GIT.has(sub) || (sub === 'branch' && rest.every(a => /^(-a|-r|-v|-vv|--list|--show-current)$/.test(a)));
      return READ_ONLY.has(cmd);
    });
}

function emit(output, done) {
  process.stdout.write(JSON.stringify(output), done);
}

function ask(reason, done) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `jev-guard: ${reason}`,
    },
  }, done);
}

async function decide(input) {
  const command = String(input.tool_input?.command ?? '');
  if (!command.trim() || isReadOnly(command)) return emit({});
  if (!Number.isFinite(MAX_RISK)) return ask('JEV_GUARD_MAX_RISK is not a number');
  const { readKey, missingKeyReason, workReason, askJev, safeErrorReason, appendLog } = require('../lib/jev');
  if (command.length > MAX_COMMAND_CHARS) {
    appendLog(LOG_FILE, 'jev-guard', { skipped: `command over ${MAX_COMMAND_CHARS} chars`, chars: command.length });
    return emit({});
  }
  const blocked = workReason(input.cwd, command);
  if (blocked) {
    appendLog(LOG_FILE, 'jev-guard', { skipped: blocked });
    return emit({});
  }

  const { key, malformed } = readKey();
  if (!key) return ask(`${missingKeyReason(malformed)}; cannot judge`);

  const sent = redact(command);
  let answer;
  try {
    answer = (await askJev(key, { command: sent, cwd: input.cwd }, { risk: QUESTION })).risk;
  } catch (err) {
    const reason = safeErrorReason(err);
    const outage = /^HTTP 5\d\d$/.test(reason);
    appendLog(LOG_FILE, 'jev-guard', { command: sent, error: reason, ...(outage && { verdict: 'defer' }) });
    if (outage) return emit({});
    return ask(`TypeSafe call failed (${reason}); cannot judge`);
  }

  const risky = answer.probabilities.risky;
  if (typeof risky !== 'number' || !Number.isFinite(risky)) return ask('Jev returned no risk score');
  const verdict = risky > MAX_RISK ? 'ask' : 'defer';
  appendLog(LOG_FILE, 'jev-guard', { command: sent, risky, verdict });
  if (verdict === 'ask') return ask(`Jev rates this ${Math.round(risky * 100)}% risky`);
  emit({});
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  const timer = setTimeout(() => {
    ask(`no verdict within ${DEADLINE_MS / 1000}s`, () => process.exit(0));
  }, DEADLINE_MS);
  Promise.resolve()
    .then(() => decide(JSON.parse(raw)))
    .catch(err => ask(`hook error (${err.name}); cannot judge`))
    .finally(() => clearTimeout(timer));
});
