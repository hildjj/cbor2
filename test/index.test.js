import {decode, encode} from '../lib/index.js';
import assert from 'node:assert/strict';
import {hexToU8} from '../lib/utils.js';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

test('encode', () => {
  assert.deepEqual(encode('foo'), hexToU8('63666f6f'));
});

test('decode', () => {
  assert.deepEqual(decode(new Uint8Array([0])), 0);
});
