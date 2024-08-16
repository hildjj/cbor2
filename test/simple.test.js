import {Simple} from '../lib/simple.js';
import assert from 'node:assert/strict';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import util from 'node:util';

test('Simple', () => {
  const s = new Simple(0);
  assert.equal(s.toString(), 'simple(0)');
  assert.equal(util.inspect(s, {colors: false}), 'simple(0)');
  assert.deepEqual(s.decode(), new Simple(0));
  assert.equal(new Simple(20).decode(), false);
});
