const test = require('node:test');
const assert = require('node:assert');
const { reviewTier } = require('./review-prs');

test('size alone sets the tier, with standard as the floor', () => {
  assert.strictEqual(reviewTier({ files: ['db/migrate/2026_x.rb'], lines: 3 }).tier, 'standard');
  assert.strictEqual(reviewTier({ files: ['a.ts'], lines: 400 }).tier, 'standard');
  assert.strictEqual(reviewTier({ files: ['a.ts'], lines: 401 }).tier, 'heavy');
  assert.strictEqual(reviewTier({ files: Array.from({ length: 21 }, (_, i) => `f${i}.ts`), lines: 50 }).tier, 'heavy');
});
