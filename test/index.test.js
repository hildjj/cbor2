import {decode, encode} from '../lib/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('encode', () => {
  assert.deepEqual(encode('foo'), new Uint8Array([0]));
});

test('decode', () => {
  assert.deepEqual(decode(new Uint8Array([0])), 0);
});
