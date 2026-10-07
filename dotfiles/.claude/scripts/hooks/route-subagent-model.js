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

const MODEL_QUESTION = {
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

const EFFORT_QUESTION = {
  type: 'choice',
  instructions:
    'A lead engineer is handing the task in `brief.prompt` to a subagent that sees only that text. ' +
    'Pick the least thinking effort the subagent needs to do it well, judged by how much reasoning the brief leaves unresolved, not by how big the task is.',
  criteria: {
    low: 'Nothing to work out: apply a stated change, run commands and report, or look something up with an exact target.',
    medium: 'Some working out inside clear bounds: follow a named pattern, fix a focused bug, or search with a clear goal.',
    high: 'Real reasoning left open: design, review, tradeoffs, an unclear goal, or a subtle bug.',
  },
};

// Downshift only when the costlier tiers carry almost no probability. Never picks the top tier,
// so a route can only lower cost against what the subagent would inherit.
function downshift(p, [cheap, mid, top]) {
  const topP = p[top] ?? 1;
  const midP = p[mid] ?? 1;
  if (midP + topP < MAX_RISK) return cheap;
  if (topP < MAX_RISK) return mid;
  return null;
}

const ROUTES = {
  model: { question: MODEL_QUESTION, tiers: ['haiku', 'sonnet', 'opus'] },
  effort: { question: EFFORT_QUESTION, tiers: ['low', 'medium', 'high'] },
};

function log(entry) {
  appendLog(LOG_FILE, 'jev-router', entry);
}

function emit(output) {
  process.stdout.write(JSON.stringify(output));
}

function formatOdds(p, tiers) {
  return tiers.map(t => `${t} ${Math.round((p[t] ?? 0) * 100)}%`).join(', ');
}

async function main(raw) {
  const input = JSON.parse(raw);
  const toolInput = input.tool_input || {};
  if (!ROUTABLE_TYPES.has(toolInput.subagent_type)) return emit({});
  const open = Object.keys(ROUTES).filter(name => !toolInput[name]);
  if (!open.length) return emit({});

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
    return emit({ systemMessage: `jev-router: ${missingKeyReason(malformed)}; subagent inherits the session settings` });
  }

  let answers;
  try {
    const questions = Object.fromEntries(open.map(name => [name, ROUTES[name].question]));
    answers = await askJev(key, { brief: { description, prompt } }, questions);
  } catch (err) {
    const reason = safeErrorReason(err);
    log({ description, error: reason });
    return emit({ systemMessage: `jev-router: TypeSafe call failed (${reason}); subagent inherits the session settings` });
  }

  const updates = {};
  const parts = [];
  for (const name of open) {
    const { choice, confidence, probabilities } = answers[name];
    const { tiers } = ROUTES[name];
    const applied = downshift(probabilities, tiers);
    log({ description, route: name, choice, confidence, probabilities, applied });
    if (applied) updates[name] = applied;
    parts.push(`${name} ${formatOdds(probabilities, tiers)} → ${applied ?? 'inherit'}`);
  }

  const systemMessage = `jev-router: ${parts.join(' · ')}`;
  if (!Object.keys(updates).length) return emit({ systemMessage });

  emit({
    systemMessage,
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...toolInput, ...updates } },
  });
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () =>
  main(raw).catch(err => emit({ systemMessage: `jev-router: ${err.name}; subagent inherits the session settings` })),
);
