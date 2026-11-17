const test = require('node:test');
const assert = require('node:assert');
const { marketplaceAddArgs, plan } = require('./sync-plugins');

const add = (...rest) => ['plugin', 'marketplace', 'add', ...rest];

test('github source registers by owner/repo, with ref and sparse paths', () => {
  assert.deepEqual(marketplaceAddArgs({ source: 'github', repo: 'a/b' }), add('a/b'));
  assert.deepEqual(marketplaceAddArgs({ source: 'github', repo: 'a/b', ref: 'v1' }), add('a/b@v1'));
  assert.deepEqual(
    marketplaceAddArgs({ source: 'github', repo: 'a/b', sparsePaths: ['.claude-plugin', 'plugins'] }),
    add('a/b', '--sparse', '.claude-plugin', 'plugins'),
  );
});

test('git, directory and url sources register by their location', () => {
  assert.deepEqual(marketplaceAddArgs({ source: 'git', url: 'git@h:o/r', ref: 'main' }), add('git@h:o/r#main'));
  assert.deepEqual(marketplaceAddArgs({ source: 'directory', path: '/x' }), add('/x'));
  assert.deepEqual(marketplaceAddArgs({ source: 'url', url: 'https://h/m.json' }), add('https://h/m.json'));
});

test('sources the CLI cannot express return null instead of a wrong registration', () => {
  assert.equal(marketplaceAddArgs({ source: 'github', repo: 'a/b', path: 'x/marketplace.json' }), null);
  assert.equal(marketplaceAddArgs({ source: 'url', url: 'https://h', headers: { A: 'b' } }), null);
  assert.equal(marketplaceAddArgs({ source: 'settings', name: 'x', plugins: [] }), null);
});

test('plan registers only undeclared-here marketplaces and installs only missing wanted plugins', () => {
  const baseline = {
    extraKnownMarketplaces: {
      known: { source: { source: 'github', repo: 'a/known' } },
      fresh: { source: { source: 'github', repo: 'a/fresh' } },
    },
    enabledPlugins: { 'have@known': true, 'want@fresh': true, 'nope@known': false },
  };
  const result = plan(baseline, new Set(['known']), new Set(['have@known']));
  assert.deepEqual(result.marketplaces, [{ name: 'fresh', args: add('a/fresh') }]);
  assert.deepEqual(result.plugins, ['want@fresh']);
});
