const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseRiskPatterns, reviewPluginRoot, reviewTier } = require('./review-prs');

const pluginsDir = path.join(os.homedir(), '.claude', 'plugins');
const realRoot = (() => { try { return reviewPluginRoot(); } catch { return null; } })();
const realFile = realRoot && path.join(realRoot, 'skills', 'team-pr-review', 'references', 'risk-paths.txt');

function fakeRead(marketSource) {
  const files = {
    [path.join(pluginsDir, 'installed_plugins.json')]: { plugins: { 'team-pr-review@presentation-skills': [{ installPath: '/cache/team-pr-review/1.0.0' }] } },
    [path.join(pluginsDir, 'known_marketplaces.json')]: { 'presentation-skills': { source: marketSource } },
    '/ws/.claude-plugin/marketplace.json': { plugins: [{ name: 'team-pr-review', source: './plugins/team-pr-review' }] },
  };
  return file => {
    if (!(file in files)) throw new Error(`unexpected read ${file}`);
    return files[file];
  };
}
const patterns = parseRiskPatterns('# comment\n\n(^|/)db/migrate/\n(^|/|_)(auth|sso|oauth|oidc)(/|_|\\.|$)\n');

test('blank and comment lines never become patterns', () => {
  assert.strictEqual(patterns.length, 2);
  assert.deepStrictEqual(parseRiskPatterns('\n   \n# only comments\n'), []);
});

test('a risky path is heavy regardless of size', () => {
  assert.deepStrictEqual(reviewTier({ files: ['db/migrate/2026_x.rb'], lines: 3 }, patterns), { tier: 'heavy', why: 'db/migrate/2026_x.rb' });
});

test('segment-anchored auth does not catch processor or author', () => {
  const { tier } = reviewTier({ files: ['app/models/processor.rb', 'lib/author.rb'], lines: 10 }, patterns);
  assert.strictEqual(tier, 'light');
  assert.strictEqual(reviewTier({ files: ['src/infrastructure/sso/client.ts'], lines: 10 }, patterns).tier, 'heavy');
});

test('size sets the tier when no path is risky', () => {
  assert.strictEqual(reviewTier({ files: ['README.md', 'docs/a.md'], lines: 60 }, patterns).tier, 'light');
  assert.strictEqual(reviewTier({ files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'], lines: 20 }, patterns).tier, 'standard');
  assert.strictEqual(reviewTier({ files: ['a.ts'], lines: 401 }, patterns).tier, 'heavy');
  assert.strictEqual(reviewTier({ files: Array.from({ length: 21 }, (_, i) => `f${i}.ts`), lines: 50 }, patterns).tier, 'heavy');
});

test('no patterns means heavy', () => {
  assert.deepStrictEqual(reviewTier({ files: ['README.md'], lines: 1 }, undefined), { tier: 'heavy', why: 'risk patterns unavailable' });
});

test('a directory marketplace resolves to its live folder, not the install snapshot', () => {
  assert.strictEqual(reviewPluginRoot(fakeRead({ source: 'directory', path: '/ws' })), '/ws/plugins/team-pr-review');
});

test('any other marketplace resolves to installPath', () => {
  assert.strictEqual(reviewPluginRoot(fakeRead({ source: 'github', repo: 'o/r' })), '/cache/team-pr-review/1.0.0');
});

test('installed risk-paths.txt parses and has no match-everything line', { skip: !realFile || !fs.existsSync(realFile) }, () => {
  const real = parseRiskPatterns(fs.readFileSync(realFile, 'utf8'));
  assert.ok(real.length > 0);
  assert.strictEqual(reviewTier({ files: ['src/components/Button.tsx'], lines: 5 }, real).tier, 'light');
});
