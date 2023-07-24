import '../lib/types.js';
import {Tag} from '../lib/tag.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import util from 'node:util';

test('Tag', () => {
  const t = new Tag(0, '2023-07-21T22:16:20-0600');
  assert(t);
  // Mostly a no-op to get the types to work out
  assert.equal(t.pop(), '2023-07-21T22:16:20-0600');
  assert.equal(util.inspect(t, {colors: false}), "0('2023-07-21T22:16:20-0600')");

  const t0 = Tag.clearType(0);
  assert(t0);
  assert.equal(t.convert(), t);
  assert.equal(Tag.registerType(0, t0), undefined);
  assert.notEqual(t.convert(), t);
});
