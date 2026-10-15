const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pinAll, pinned } = require('./pin-test-browser');

const CFT = 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

function fakeHome({ builds = ['chromium-1223'], playwrightArgs = ['@playwright/mcp@latest'] } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-test-browser-'));
  for (const build of builds) {
    const bin = path.join(home, 'Library/Caches/ms-playwright', build, CFT);
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '');
  }
  const cache = path.join(home, '.claude/plugins/cache/claude-plugins-official');
  const pw = path.join(cache, 'playwright/abc123/.mcp.json');
  fs.mkdirSync(path.dirname(pw), { recursive: true });
  fs.writeFileSync(pw, JSON.stringify({ playwright: { command: 'npx', args: playwrightArgs } }));
  const dt = path.join(cache, 'chrome-devtools-mcp/1.9.0/.claude-plugin/plugin.json');
  fs.mkdirSync(path.dirname(dt), { recursive: true });
  fs.writeFileSync(dt, JSON.stringify({
    mcpServers: { 'chrome-devtools': { command: 'npx', args: ['chrome-devtools-mcp@1.9.0'] } },
  }));
  return { home, pw, dt };
}

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('pins both plugins to the newest Chrome for Testing build', () => {
  const { home, pw, dt } = fakeHome({ builds: ['chromium-1199', 'chromium-1223'] });
  const { changed } = pinAll({ home, log: () => {} });
  assert.equal(changed.length, 2);
  assert.match(read(pw).playwright.args.at(-1), /^--executable-path=.*chromium-1223/);
  assert.match(read(dt).mcpServers['chrome-devtools'].args.at(-1), /^--executablePath=.*chromium-1223/);
});

test('a second run changes nothing', () => {
  const { home } = fakeHome();
  pinAll({ home, log: () => {} });
  assert.deepEqual(pinAll({ home, log: () => {} }).changed, []);
});

test('a stale pin from an older build is replaced, not duplicated', () => {
  assert.deepEqual(
    pinned(['x', '--executable-path=/old'], '--executable-path=', '/new'),
    ['x', '--executable-path=/new'],
  );
});

test('no Chrome for Testing means nothing is written and it says why', () => {
  const { home, pw } = fakeHome({ builds: [] });
  const logs = [];
  assert.deepEqual(pinAll({ home, log: (m) => logs.push(m) }).changed, []);
  assert.deepEqual(read(pw).playwright.args, ['@playwright/mcp@latest']);
  assert.match(logs[0], /playwright install chromium/);
});
