#!/usr/bin/env node
'use strict';

const os = require('os');
const path = require('path');
const { readKey, missingKeyReason, workReason, askJev, safeErrorReason, appendLog } = require('../lib/jev');

const LOG_FILE = path.join(os.homedir(), '.cache', 'jev-router', 'decisions.jsonl');
const MAX_PROMPT_CHARS = 12000;
const MAX_RISK = Number(process.env.JEV_ROUTER_MAX_RISK ?? 0.15);

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

// Downshift only when the costlier tiers carry almost no probability.
function pickModel(p) {
  const opus = p.opus ?? 1;
  const sonnet = p.sonnet ?? 1;
  if (sonnet + opus < MAX_RISK) return 'haiku';
  if (opus < MAX_RISK) return 'sonnet';
  return null;
}

function log(entry) {
  appendLog(LOG_FILE, 'jev-router', entry);
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
    return emit({ systemMessage: `jev-router: ${missingKeyReason(malformed)}; subagent inherits the session model` });
  }

  let answer;
  try {
    answer = (await askJev(key, { brief: { description, prompt } }, { model: QUESTION })).model;
  } catch (err) {
    const reason = safeErrorReason(err);
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
