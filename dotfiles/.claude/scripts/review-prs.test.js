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

test('pnpm lock gate passes trunk registries and in-repo links, flags every other fetch', () => {
  const { pnpmLockProblems } = require('./review-prs');
  const jfrog = v => ({ resolution: { integrity: 'sha512-x', tarball: `https://thinknear.jfrog.io/x/-/x-${v}.tgz` } });
  const base = {
    lockfileVersion: '9.0',
    importers: { '.': { dependencies: { a: { specifier: '^1', version: '1.0.0' } } } },
    packages: { 'a@1.0.0': { resolution: { integrity: 'sha512-a' } }, '@inmarket/x@1.0.0': jfrog('1.0.0') },
  };
  const head = (packages, deps = {}) => pnpmLockProblems(base, {
    ...base,
    importers: { '.': { dependencies: { ...base.importers['.'].dependencies, ...deps } }, 'packages/web': {} },
    packages: { ...base.packages, ...packages },
  });

  assert.deepStrictEqual(head(
    { 'a@1.1.0': { resolution: { integrity: 'sha512-b' } }, '@inmarket/x@2.0.0': jfrog('2.0.0') },
    { a: { specifier: '^1', version: '1.1.0(react@18.0.0)' }, shared: { specifier: 'workspace:*', version: 'link:packages/shared' } },
  ), []);

  for (const resolution of [
    { type: 'git', repo: 'https://github.com/evil/b', commit: 'abc' },
    { integrity: 'sha512-x', tarball: 'https://evil.example/b.tgz' },
    { tarball: 'http://registry.npmjs.org/b/-/b-1.0.0.tgz' },
    { directory: '../outside', type: 'directory' },
    { type: 'binary', url: 'https://evil.example/node.tgz' },
    undefined,
  ]) {
    assert.strictEqual(head({ 'b@1.0.0': { resolution } }).length, 1, JSON.stringify(resolution));
  }
  for (const version of ['link:../outside', 'file:../b', 'https://evil.example/b.tgz']) {
    assert.strictEqual(head({}, { b: { specifier: version, version } }).length, 1, version);
  }
  assert.strictEqual(pnpmLockProblems(base, { lockfileVersion: '6.0' }).length, 1);
});

test('pnpm lockfile parses like pnpm reads it, or not at all', () => {
  const { parseYamlLock } = require('./review-prs');
  const quoted = parseYamlLock("lockfileVersion: '9.0'\npackages:\n  b@1.0.0:\n    \"resolution\": {\"tarball\": https://evil.example/b.tgz}\n");
  assert.strictEqual(quoted.packages['b@1.0.0'].resolution.tarball, 'https://evil.example/b.tgz');
  for (const yaml of [
    "x: &r {tarball: https://evil.example/b.tgz}\npackages:\n  b@1.0.0:\n    resolution: *r\n",
    "packages:\n  b@1.0.0:\n    resolution:\n      <<: {tarball: https://evil.example/b.tgz}\n",
    "packages:\n  b@1.0.0:\n    resolution: !custom {integrity: x}\n",
    "? [packages]\n: b@1.0.0:\n    resolution: {tarball: https://evil.example/b.tgz}\n",
    "packages:\n  ? {b: 1}\n  : resolution: {integrity: x}\n",
  ]) {
    assert.throws(() => parseYamlLock(yaml), /anchors/, yaml);
  }
  assert.throws(() => parseYamlLock('~\n'), /not a map/);
  assert.throws(() => parseYamlLock("a: 1\n---\nlockfileVersion: '9.0'\n"), /more than one/);
});

test('mise version files match at any depth, lookalikes do not', () => {
  const { MISE_VERSION_FILE } = require('./review-prs');
  for (const f of ['.ruby-version', 'Gemfile', 'api/.tool-versions', '.Ruby-Version']) assert.ok(MISE_VERSION_FILE.test(f), f);
  for (const f of ['Gemfile.lock', 'x.ruby-version', 'docs/Gemfile.md', '.nvmrc']) assert.ok(!MISE_VERSION_FILE.test(f), f);
});

test('generated husky hooks are not local work, other ignored files are', () => {
  const { ignoredWork } = require('./review-prs');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'review-prs-'));
  execFileSync('git', ['init', '-q', wt]);
  const write = (file, body) => {
    fs.mkdirSync(path.dirname(path.join(wt, file)), { recursive: true });
    fs.writeFileSync(path.join(wt, file), body);
  };
  write('.gitignore', 'notes/\n');
  write('.husky/pre-commit', 'x');
  execFileSync('git', ['-C', wt, 'add', '.']);
  write('.husky/_/.gitignore', '*');
  write('.husky/_/pre-commit', 'x');
  write('notes/plan.md', 'x');
  assert.deepStrictEqual(ignoredWork(wt, path.join(wt, 'no-clone')), ['notes/']);
  fs.rmSync(wt, { recursive: true, force: true });
});

test('triage output maps to a tier only when every field is valid', () => {
  const { parseTriage, TIER_ARGS } = require('./review-prs');
  const envelope = structured_output => JSON.stringify({ type: 'result', is_error: false, structured_output });

  for (const tier of ['light', 'standard', 'heavy']) {
    const parsed = parseTriage(envelope({ tier, xhigh: false, why: 'x' }));
    assert.strictEqual(parsed.tier, tier);
    assert.ok(TIER_ARGS[parsed.tier]);
  }
  assert.strictEqual(parseTriage(envelope({ tier: 'heavy', xhigh: true, why: 'x' })).tier, 'heavy-xhigh');
  assert.strictEqual(parseTriage(envelope({ tier: 'light', xhigh: true, why: 'x' })).tier, 'light');
  assert.ok(TIER_ARGS['heavy-xhigh']);

  const long = parseTriage(envelope({ tier: 'light', xhigh: false, why: `a\nb ${'c'.repeat(200)}` })).why;
  assert.ok(long.length <= 80 && !long.includes('\n'));

  for (const bad of [
    'not json',
    JSON.stringify({ is_error: true, result: 'API Error' }),
    JSON.stringify({ is_error: false }),
    envelope({ tier: 'huge', xhigh: false, why: 'x' }),
    envelope({ tier: 'light', why: 'x' }),
    envelope({ tier: 'light', xhigh: false }),
  ]) assert.throws(() => parseTriage(bad));
});

test('triage rules come from the skill, and missing markers fail rather than send no rules', () => {
  const { triageRules } = require('./review-prs');
  const skill = [
    '## Step 3', '**Size the review** from that list.', 'Heavy when…', '## Step 4 — Derive',
    '## Step 7 — Sweep', 'intro', '**Heavy tier:** dispatch', '- **Access scope** — x', '- **Performance** — y', 'Each class ends somewhere.', '## Step 8',
  ].join('\n');
  const rules = triageRules(skill);
  assert.match(rules, /Size the review[\s\S]*Heavy when/);
  assert.match(rules, /Access scope[\s\S]*Performance/);
  assert.doesNotMatch(rules, /Step 4|dispatch|Each class ends|Step 8/);

  assert.throws(() => triageRules(skill.replace('**Size the review**', 'Size the review')), /sizing/);
  assert.throws(() => triageRules(skill.replace('## Step 4', '## Step four')), /sizing/);
  assert.throws(() => triageRules(skill.replace('Each class ends', 'Every class ends')), /Step 7/);
  assert.throws(() => triageRules(skill.replace(/- \*\*/g, '* ')), /Step 7/);
});

test('triage raises the size tier but only lowers a small diff', () => {
  const { floorTier } = require('./review-prs');
  assert.strictEqual(floorTier('light', 'standard'), 'light');
  assert.strictEqual(floorTier('heavy-xhigh', 'standard'), 'heavy-xhigh');
  assert.strictEqual(floorTier('light', 'heavy'), 'heavy');
  assert.strictEqual(floorTier('standard', 'heavy'), 'heavy');
  assert.strictEqual(floorTier('heavy-xhigh', 'heavy'), 'heavy-xhigh');
});
