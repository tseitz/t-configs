const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, 'direnv-wrap.js');
const PREFIX = 'eval "$(direnv export bash 2>/dev/null)" && ';

function run(command, cwd) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-wrap-home-'));
  const env = { ...process.env, HOME: home };
  delete env.CLAUDE_PROJECT_DIR;
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify({ cwd, tool_input: { command } }),
    env,
  });
  return JSON.parse(out).hookSpecificOutput?.updatedInput?.command ?? null;
}

function tree({ envrc }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-wrap-'));
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  if (envrc) fs.writeFileSync(path.join(root, '.envrc'), '');
  return nested;
}

test('wraps when a parent directory has an .envrc', () => {
  assert.equal(run('ls', tree({ envrc: true })), `${PREFIX}ls`);
});

test('leaves the command alone when no .envrc is above cwd', () => {
  assert.equal(run('ls', tree({ envrc: false })), null);
});

test('does not wrap an already-wrapped command a second time', () => {
  assert.equal(run(`${PREFIX}ls`, tree({ envrc: true })), null);
});
