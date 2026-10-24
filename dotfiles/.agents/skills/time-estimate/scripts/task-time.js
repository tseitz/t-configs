#!/usr/bin/env node
/**
 * Measures and logs task time for the time-estimate skill.
 *
 * Usage:
 *   task-time.js measure <since> <until> <session-id>...
 *   task-time.js fold personal|work
 *   task-time.js append personal|work < event.json
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const IDLE_MS = 30 * 60 * 1000;
const STALE_MS = 3 * 24 * 60 * 60 * 1000;
const EVENTS = ['open', 'touch', 'drop', 'close', 'ship'];
const LOG_DIR = path.join(os.homedir(), 't-configs', 'dotfiles', '.claude');
const LOGS = { personal: 'estimates.jsonl', work: 'estimates.work.jsonl' };
const ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The personal log is pushed to a public repo: anything not listed here is refused, not dropped.
const PUBLIC_KEYS = new Set(['ev', 'id', 'at', 'start', 'session', 'slug', 'repo', 'type', 'tier', 'files_est', 'est', 'actual', 'ratio', 'why_off', 'note']);

const minutes = ms => Math.round(ms / 6000) / 10;

function parseJsonl(text) {
  const entries = [];
  let unparseable = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      unparseable++;
    }
  }
  return { entries, unparseable };
}

const isTurnEnd = e => e.type === 'system' && e.subtype === 'turn_duration';
const isHumanTurn = e => e.type === 'user' && e.origin?.kind === 'human';

function measureOne(entries, since, until, idleMs) {
  const timed = entries
    .map(e => ({ e, t: Date.parse(e.timestamp) }))
    .filter(({ t }) => !Number.isNaN(t) && t >= since && t <= until)
    .sort((a, b) => a.t - b.t);

  let agentMs = 0;
  let humanMs = 0;
  let idleDropped = 0;
  let humanTurns = 0;
  let lastTurnEnd = null;
  let openTurnStart = null;
  let lastSeen = null;
  for (const { e, t } of timed) {
    if (isTurnEnd(e)) {
      agentMs += Number(e.durationMs) || 0;
      lastTurnEnd = t;
      openTurnStart = null;
    } else if (isHumanTurn(e)) {
      humanTurns++;
      if (lastTurnEnd !== null) {
        const gap = t - lastTurnEnd;
        if (gap > idleMs) idleDropped++;
        else humanMs += gap;
      }
      lastTurnEnd = null;
      openTurnStart = t;
    } else if (e.type === 'user' || e.type === 'assistant') {
      if (openTurnStart === null) openTurnStart = t;
      lastSeen = t;
    }
  }
  // Close usually runs inside the last turn, which has no turn_duration yet.
  if (openTurnStart !== null && lastSeen !== null && lastSeen > openTurnStart) agentMs += lastSeen - openTurnStart;
  return { agentMs, humanMs, idleDropped, humanTurns };
}

// Gaps are per session: two sessions running at once must not stitch into one timeline.
function measure(entries, { since, until, idleMs = IDLE_MS }) {
  const sinceMs = Date.parse(since);
  const untilMs = Date.parse(until);
  if (Number.isNaN(sinceMs) || Number.isNaN(untilMs)) throw new Error(`bad window: ${since} → ${until}`);

  const bySession = new Map();
  for (const e of entries) {
    const key = e.sessionId ?? '';
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(e);
  }

  const total = { agentMs: 0, humanMs: 0, idleDropped: 0, humanTurns: 0 };
  for (const group of bySession.values()) {
    const one = measureOne(group, sinceMs, untilMs, idleMs);
    for (const k of Object.keys(total)) total[k] += one[k];
  }
  const agent = minutes(total.agentMs);
  const human = minutes(total.humanMs);
  return {
    agent,
    human,
    session: minutes(total.agentMs + total.humanMs),
    idle_dropped: total.idleDropped,
    human_turns: total.humanTurns,
  };
}

function fold(events, now) {
  const nowMs = Date.parse(now);
  const byId = new Map();
  for (const ev of events) {
    if (!byId.has(ev.id)) byId.set(ev.id, { id: ev.id, state: null, open: null, touches: [], drop: null, close: null, ship: null });
    const entry = byId.get(ev.id);
    if (ev.ev === 'touch') entry.touches.push(ev);
    else if (EVENTS.includes(ev.ev)) entry[ev.ev] = ev;
  }

  const entries = [...byId.values()].map(entry => {
    let state = 'orphan';
    if (entry.ship) state = 'shipped';
    else if (entry.close) state = 'closed';
    else if (entry.drop) state = 'dropped';
    else if (entry.open) state = 'open';
    return { ...entry, state };
  });

  const stale = entries
    .filter(e => e.state === 'open')
    .filter(e => nowMs - Date.parse(e.open.start ?? e.open.at) > STALE_MS)
    .map(e => e.id);

  return { entries, stale };
}

function validateEvent(ev, { isPublic = false } = {}) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) throw new Error('event must be a JSON object');
  if (!EVENTS.includes(ev.ev)) throw new Error(`ev must be one of ${EVENTS.join('|')}, got ${JSON.stringify(ev.ev)}`);
  if (typeof ev.id !== 'string' || !ID_RE.test(ev.id)) throw new Error(`id must match ${ID_RE}, got ${JSON.stringify(ev.id)}`);
  if (ev.session !== undefined && !SESSION_RE.test(ev.session)) throw new Error(`bad session id ${JSON.stringify(ev.session)}`);
  if (isPublic) {
    const extra = Object.keys(ev).filter(k => !PUBLIC_KEYS.has(k));
    if (extra.length) throw new Error(`refusing keys in the public log: ${extra.join(', ')}`);
  }
  return ev;
}

function logPath(axis) {
  if (!LOGS[axis]) throw new Error(`log must be ${Object.keys(LOGS).join('|')}, got ${JSON.stringify(axis)}`);
  return path.join(LOG_DIR, LOGS[axis]);
}

function findTranscript(sessionId, projectsDir = PROJECTS_DIR) {
  if (!SESSION_RE.test(sessionId)) throw new Error(`bad session id ${JSON.stringify(sessionId)}`);
  for (const slug of fs.readdirSync(projectsDir)) {
    const file = path.join(projectsDir, slug, `${sessionId}.jsonl`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function readLog(file) {
  const { entries, unparseable } = parseJsonl(fs.readFileSync(file, 'utf8'));
  if (unparseable) throw new Error(`${file}: ${unparseable} unparseable line(s)`);
  return entries;
}

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === 'measure') {
    const [since, until, ...ids] = args;
    if (!since || !until || !ids.length) throw new Error('usage: measure <since> <until> <session-id>...');
    const entries = [];
    let unparseable = 0;
    for (const id of ids) {
      const file = findTranscript(id);
      if (!file) throw new Error(`no transcript for session ${id}`);
      const parsed = parseJsonl(fs.readFileSync(file, 'utf8'));
      unparseable += parsed.unparseable;
      for (const e of parsed.entries) entries.push({ ...e, sessionId: id });
    }
    console.log(JSON.stringify({ ...measure(entries, { since, until }), unparseable }));
    if (unparseable) console.error(`task-time: ${unparseable} unparseable transcript line(s) skipped`);
  } else if (cmd === 'fold') {
    const file = logPath(args[0]);
    const events = fs.existsSync(file) ? readLog(file) : [];
    console.log(JSON.stringify(fold(events, new Date().toISOString()), null, 2));
  } else if (cmd === 'append') {
    const file = logPath(args[0]);
    const ev = validateEvent(JSON.parse(fs.readFileSync(0, 'utf8')), { isPublic: args[0] === 'personal' });
    fs.appendFileSync(file, `${JSON.stringify({ ...ev, at: ev.at ?? new Date().toISOString() })}\n`);
  } else {
    throw new Error('usage: task-time.js measure <since> <until> <session-id>... | fold personal|work | append personal|work < event.json');
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`task-time: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { measure, fold, parseJsonl, validateEvent, findTranscript };
