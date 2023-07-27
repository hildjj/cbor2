import '../lib/types.js';
import {Tag} from '../lib/tag.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import util from 'node:util';

test('Tag', () => {
  const t = new Tag(0, '2023-07-21T22:16:20-0600');
  assert(t);
  assert.equal(util.inspect(t, {colors: false}), "0('2023-07-21T22:16:20-0600')");

  const t0 = Tag.clearDecoder(0);
  assert(t0);
  assert.equal(t.decode(), t);
  assert.equal(Tag.registerDecoder(0, t0), undefined);
  assert.notEqual(t.decode(), t);
});