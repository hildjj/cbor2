import '../lib/types.js';
import {box, saveEncodedLength} from '../lib/box.js';
import {hexToU8, u8toHex} from '../lib/utils.js';
import assert from 'node:assert/strict';
import {encode} from '../lib/encoder.js';

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

function eh(obj) {
  return u8toHex(encode(obj));
}

test('box', () => {
  assert.equal(eh(box('foo', hexToU8('7a00000003666f6f'))), '7a00000003666f6f');
  assert.equal(eh(box(2, hexToU8('1a00000002'))), '1a00000002');
  assert.equal(eh(box(2n, hexToU8('1a00000002'))), '1a00000002');
});

test('encoded length', () => {
  const a = [1];
  saveEncodedLength(a, hexToU8('9a00000001'));
  assert.equal(eh(a), '9a0000000101');
});
