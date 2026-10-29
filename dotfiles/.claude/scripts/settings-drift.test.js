const test = require('node:test');
const assert = require('node:assert');
const { findHookDrift, applyHookDrift } = require('./settings-drift');

const hook = (command) => ({ type: 'command', command });

const base = {
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [hook('guard.js'), hook('shared.js')] },
      { matcher: 'Agent', hooks: [hook('router.js')] },
    ],
    SessionStart: [{ hooks: [hook('pin.js')] }],
  },
};

test('reports only base hooks the machine lacks, ignoring machine-only extras', () => {
  const live = {
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [hook('shared.js'), hook('local-only.js')] }],
      SessionStart: [{ hooks: [hook('pin.js')] }],
    },
  };
  const drift = findHookDrift(live, base);
  assert.deepEqual(drift.map((d) => [d.path, d.missing]), [['hooks.PreToolUse', ['guard.js', 'router.js']]]);
});

test('a hook under another event does not count as present', () => {
  const live = { hooks: { PostToolUse: [{ hooks: [hook('pin.js')] }] } };
  assert.ok(findHookDrift(live, base).some((d) => d.path === 'hooks.SessionStart'));
});

test('apply joins a group with the same matcher, else adds one, and then nothing drifts', () => {
  const live = {
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [hook('local-only.js')] }] },
  };
  applyHookDrift(live, findHookDrift(live, base));

  const bash = live.hooks.PreToolUse.find((g) => g.matcher === 'Bash');
  assert.deepEqual(bash.hooks.map((h) => h.command), ['local-only.js', 'guard.js', 'shared.js']);
  assert.deepEqual(live.hooks.PreToolUse.find((g) => g.matcher === 'Agent').hooks, [hook('router.js')]);
  assert.deepEqual(live.hooks.SessionStart, [{ hooks: [hook('pin.js')] }]);
  assert.deepEqual(findHookDrift(live, base), []);
});
