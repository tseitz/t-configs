const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, 'direnv-env.js');

function tree({ envrc }) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-env-')));
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  if (envrc) {
    fs.writeFileSync(path.join(root, '.envrc'), 'export DIRENV_ENV_TEST=loaded\n');
    execFileSync('direnv', ['allow', root]);
  }
  return { root, nested };
}

function run(input) {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-env-file-')), 'env');
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_ENV_FILE: envFile },
  });
  return {
    output: JSON.parse(out).hookSpecificOutput,
    env: fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '',
  };
}

test('SessionStart under an .envrc writes its exports and watches it', () => {
  const { root, nested } = tree({ envrc: true });
  const { output, env } = run({ hook_event_name: 'SessionStart', cwd: nested });
  assert.match(env, /DIRENV_ENV_TEST/);
  assert.deepEqual(output.watchPaths, [path.join(root, '.envrc')]);
});

test('CwdChanged loads from new_cwd, not the old cwd', () => {
  const { nested } = tree({ envrc: true });
  const outside = tree({ envrc: false }).nested;
  const { env } = run({ hook_event_name: 'CwdChanged', cwd: outside, old_cwd: outside, new_cwd: nested });
  assert.match(env, /DIRENV_ENV_TEST/);
});

test('no .envrc above cwd writes nothing and clears the watch list', () => {
  const { nested } = tree({ envrc: false });
  const { output, env } = run({ hook_event_name: 'CwdChanged', cwd: nested, old_cwd: nested, new_cwd: nested });
  assert.equal(env, '');
  assert.deepEqual(output.watchPaths, []);
});

test('the exported env is valid zsh that sets the variable', () => {
  const { nested } = tree({ envrc: true });
  const { env } = run({ hook_event_name: 'SessionStart', cwd: nested });
  const value = execFileSync('zsh', ['-c', `${env}\nprint -r -- "$DIRENV_ENV_TEST"`], { encoding: 'utf8' });
  assert.equal(value.trim(), 'loaded');
});
