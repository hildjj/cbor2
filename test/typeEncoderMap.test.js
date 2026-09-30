import {TypeEncoderMap} from '../lib/typeEncoderMap.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('TypeEncoderMap', () => {
  const t = new TypeEncoderMap();
  assert(t);
  assert.equal(t.get(Uint8Array), undefined);
  t.registerEncoder(Uint8Array, () => undefined);
  assert.notEqual(t.get(Uint8Array), undefined);
  t.clear();
  assert.equal(t.get(Uint8Array), undefined);
});
