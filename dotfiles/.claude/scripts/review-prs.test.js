const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseRiskPatterns, reviewTier } = require('./review-prs');

const installed = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const [install] = JSON.parse(fs.readFileSync(installed, 'utf8')).plugins['team-pr-review@presentation-skills'] || [];
const realFile = install && path.join(install.installPath, 'skills', 'team-pr-review', 'references', 'risk-paths.txt');
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

test('installed risk-paths.txt parses and has no match-everything line', { skip: !realFile || !fs.existsSync(realFile) }, () => {
  const real = parseRiskPatterns(fs.readFileSync(realFile, 'utf8'));
  assert.ok(real.length > 0);
  assert.strictEqual(reviewTier({ files: ['src/components/Button.tsx'], lines: 5 }, real).tier, 'light');
});
