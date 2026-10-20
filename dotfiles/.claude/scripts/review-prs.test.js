const test = require('node:test');
const assert = require('node:assert');
const { reviewTier } = require('./review-prs');

test('size alone sets the tier, with standard as the floor', () => {
  assert.strictEqual(reviewTier({ files: ['db/migrate/2026_x.rb'], lines: 3 }).tier, 'standard');
  assert.strictEqual(reviewTier({ files: ['a.ts'], lines: 400 }).tier, 'standard');
  assert.strictEqual(reviewTier({ files: ['a.ts'], lines: 401 }).tier, 'heavy');
  assert.strictEqual(reviewTier({ files: Array.from({ length: 21 }, (_, i) => `f${i}.ts`), lines: 50 }).tier, 'heavy');
});

test('npm lock gate passes trunk registries and workspace links, flags every other fetch', () => {
  const { npmLockProblems } = require('./review-prs');
  const reg = (v, host = 'registry.npmjs.org') => ({ version: v, resolved: `https://${host}/x/-/x-${v}.tgz`, integrity: 'sha512-x' });
  const base = { packages: { '': {}, 'node_modules/a': reg('1.0.0'), 'node_modules/@x/y': reg('1.0.0', 'npm.pkg.github.com') } };
  const head = packages => npmLockProblems(base, { packages: { ...base.packages, ...packages } });

  assert.deepStrictEqual(head({
    'node_modules/a': reg('1.1.0'),
    'node_modules/@x/z': reg('2.0.0', 'npm.pkg.github.com'),
    'packages/shared': { name: 'shared', version: '0.0.0' },
    'node_modules/shared': { resolved: 'packages/shared', link: true },
  }), []);

  for (const entry of [
    { version: '1.0.0' },
    { version: '1.0.0', resolved: 'git+ssh://git@github.com/evil/b.git#abc' },
    { version: '1.0.0', resolved: 'https://evil.example/b.tgz' },
    { version: '1.0.0', resolved: 'http://registry.npmjs.org/b/-/b-1.0.0.tgz' },
    { version: 'git+https://evil.example/b.git', resolved: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz' },
    { ...reg('1.0.0'), hasShrinkwrap: true },
    { resolved: '../outside', link: true },
    { resolved: 'file:/tmp/b', link: true },
  ]) {
    assert.strictEqual(head({ 'node_modules/b': entry }).length, 1, JSON.stringify(entry));
  }
  assert.strictEqual(npmLockProblems(base, { lockfileVersion: 1, dependencies: {} }).length, 1);
});

test('package.json specs a PR adds must come from the registry', () => {
  const { offRegistrySpecs } = require('./review-prs');
  const base = { dependencies: { kept: 'github:old/kept' } };
  assert.deepStrictEqual(offRegistrySpecs(base, {
    dependencies: { kept: 'github:old/kept', a: '^1.2.3', b: 'latest', c: '1.x || >=2.0.0 <3', d: 'npm:@s/real@^2' },
    overrides: { e: '1.0.0', f: { g: '$a' } },
  }), []);
  for (const spec of ['git+https://evil.example/x.git', 'evil/x', 'github:evil/x', 'https://evil.example/x.tgz', 'file:../x', './x', 'npm:x@github:evil/x']) {
    assert.strictEqual(offRegistrySpecs(base, { devDependencies: { x: spec } }).length, 1, spec);
    assert.strictEqual(offRegistrySpecs(base, { overrides: { y: { x: spec } } }).length, 1, `overrides ${spec}`);
  }
});
