const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { measure, fold, parseJsonl, validateEvent, findTranscript } = require('./task-time');

const T0 = Date.parse('2026-01-01T10:00:00Z');
const at = min => new Date(T0 + min * 60000).toISOString();
const human = (min, extra = {}) => ({ type: 'user', origin: { kind: 'human' }, promptSource: 'typed', timestamp: at(min), ...extra });
const turnEnd = (min, durMin, extra = {}) => ({ type: 'system', subtype: 'turn_duration', durationMs: durMin * 60000, timestamp: at(min), ...extra });
const window = { since: at(-60), until: at(600) };

test('agent sums turn durations; human counts turn end to next typed turn', () => {
  const r = measure([human(0), turnEnd(5, 5), human(8), turnEnd(20, 12), human(22), turnEnd(30, 8)], window);
  assert.deepStrictEqual(r, { agent: 25, human: 5, session: 30, idle_dropped: 0, human_turns: 3 });
});

test('task-notification, sdk and compact summary entries are not human turns', () => {
  const r = measure([
    human(0),
    turnEnd(5, 5),
    { type: 'user', origin: { kind: 'task-notification' }, promptSource: 'system', timestamp: at(10) },
    { type: 'user', promptSource: 'sdk', timestamp: at(11) },
    { type: 'user', isCompactSummary: true, timestamp: at(12) },
    { type: 'user', timestamp: at(13) },
    turnEnd(15, 3),
    human(17),
  ], window);
  assert.strictEqual(r.human_turns, 2);
  assert.strictEqual(r.human, 2);
  assert.strictEqual(r.agent, 8);
});

test('a gap over 30 minutes is dropped as idle and counted', () => {
  const r = measure([human(0), turnEnd(5, 5), human(36), turnEnd(40, 4), human(70)], window);
  assert.strictEqual(r.human, 30);
  assert.strictEqual(r.idle_dropped, 1);
});

test('entries outside the window and without timestamps are ignored', () => {
  const r = measure([
    turnEnd(-100, 50),
    human(-95),
    turnEnd(0, 4),
    { type: 'system', subtype: 'turn_duration', durationMs: 999999 },
    human(3),
    turnEnd(10, 7),
    human(700),
  ], { since: at(-1), until: at(20) });
  assert.deepStrictEqual(r, { agent: 11, human: 3, session: 14, idle_dropped: 0, human_turns: 1 });
});

test('sessions are measured separately and summed', () => {
  const a = [human(0, { sessionId: 'a' }), turnEnd(5, 5, { sessionId: 'a' }), human(10, { sessionId: 'a' })];
  const b = [turnEnd(6, 2, { sessionId: 'b' }), human(9, { sessionId: 'b' })];
  const r = measure([...a, ...b], window);
  assert.deepStrictEqual(r, { agent: 7, human: 8, session: 15, idle_dropped: 0, human_turns: 3 });
});

test('bad window throws', () => {
  assert.throws(() => measure([], { since: 'nope', until: at(0) }), /bad window/);
});

test('parseJsonl counts unparseable lines instead of dropping them silently', () => {
  const { entries, unparseable } = parseJsonl('{"a":1}\nnot json\n\n{"b":2}\n{"trunc');
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(unparseable, 2);
});

test('fold folds events into state per id', () => {
  const day = d => new Date(T0 + d * 86400000).toISOString();
  const { entries } = fold([
    { ev: 'open', id: 'a', at: day(0), start: day(0) },
    { ev: 'touch', id: 'a', at: day(1), session: 's2' },
    { ev: 'close', id: 'a', at: day(1) },
    { ev: 'open', id: 'b', at: day(0) },
    { ev: 'drop', id: 'b', at: day(0) },
    { ev: 'open', id: 'c', at: day(0) },
    { ev: 'close', id: 'c', at: day(1) },
    { ev: 'ship', id: 'c', at: day(2), created_to_merged: 60 },
    { ev: 'touch', id: 'd', at: day(0) },
  ], day(2));
  const state = Object.fromEntries(entries.map(e => [e.id, e.state]));
  assert.deepStrictEqual(state, { a: 'closed', b: 'dropped', c: 'shipped', d: 'orphan' });
  assert.strictEqual(entries.find(e => e.id === 'a').touches.length, 1);
});

test('stale lists only entries open more than 3 days, measured from start', () => {
  const day = d => new Date(T0 + d * 86400000).toISOString();
  const { stale } = fold([
    { ev: 'open', id: 'old', at: day(1), start: day(0) },
    { ev: 'open', id: 'fresh', at: day(2) },
    { ev: 'open', id: 'closed', at: day(0) },
    { ev: 'close', id: 'closed', at: day(1) },
  ], day(3.5));
  assert.deepStrictEqual(stale, ['old']);
});

test('validateEvent requires a known ev and a dated kebab id', () => {
  const id = '2026-10-24-some-task';
  assert.doesNotThrow(() => validateEvent({ ev: 'open', id }));
  assert.throws(() => validateEvent({ ev: 'bogus', id }), /ev must be/);
  assert.throws(() => validateEvent({ ev: 'open' }), /id must match/);
  assert.throws(() => validateEvent({ ev: 'open', id: "x'; rm -rf ~; '" }), /id must match/);
  assert.throws(() => validateEvent({ ev: 'touch', id, session: '../../etc' }), /bad session id/);
  assert.throws(() => validateEvent([]), /JSON object/);
});

test('the public log refuses keys outside its allowlist', () => {
  const ev = { ev: 'close', id: '2026-10-24-some-task', pr: { repo: 'org/private', number: 1 } };
  assert.doesNotThrow(() => validateEvent(ev));
  assert.throws(() => validateEvent(ev, { isPublic: true }), /refusing keys in the public log: pr/);
});

test('findTranscript searches every project slug', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-time-'));
  fs.mkdirSync(path.join(dir, 'proj-a'));
  fs.mkdirSync(path.join(dir, 'proj-b'));
  const sid = '11111111-2222-3333-4444-555555555555';
  fs.writeFileSync(path.join(dir, 'proj-b', `${sid}.jsonl`), '');
  assert.strictEqual(findTranscript(sid, dir), path.join(dir, 'proj-b', `${sid}.jsonl`));
  assert.strictEqual(findTranscript('99999999-2222-3333-4444-555555555555', dir), null);
  assert.throws(() => findTranscript('../../x', dir), /bad session id/);
  fs.rmSync(dir, { recursive: true });
});

test('a turn still running at until counts as agent time up to its last entry', () => {
  const assistant = min => ({ type: 'assistant', timestamp: at(min) });
  const entries = [human(0), assistant(1), turnEnd(2, 2), human(5), assistant(6), assistant(9)];
  const r = measure(entries, { since: at(0), until: at(10) });
  assert.strictEqual(r.agent, 6);
  assert.strictEqual(r.human, 3);
});

test('a background-notification turn starts at its first entry, not the previous turn end', () => {
  const assistant = min => ({ type: 'assistant', timestamp: at(min) });
  const notice = min => ({ type: 'user', origin: { kind: 'task-notification' }, timestamp: at(min) });
  const entries = [human(0), turnEnd(1, 1), notice(20), assistant(22)];
  assert.strictEqual(measure(entries, { since: at(0), until: at(30) }).agent, 3);
});
