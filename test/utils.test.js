import * as utils from '../lib/utils.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('ranges', () => {
  const u8 = new Uint8Array(1);
  assert.ok(!utils.hasRanges(u8));
  utils.setRanges(u8, [[0, 1, '"']]);
  assert.deepEqual(utils.getRanges(u8), [[0, 1, '"']]);
  const u8_2 = new Uint8Array(1);
  const cat = utils.u8concat([u8, u8_2]);
  assert.equal(cat.length, 2);
  assert.deepEqual(utils.getRanges(cat), [[0, 1, '"'], [1, 1]]);

  assert.throws(() => {
    utils.u8concat(['foo']);
  });
});

test('hexToU8fallback', () => {
  const u8 = utils.hexToU8fallback('00010ab1');
  assert.deepEqual(u8, new Uint8Array([0x00, 0x01, 0x0a, 0xb1]));
});

test('u8toHexFallback', () => {
  const s = utils.u8toHexFallback(new Uint8Array([0x00, 0x01, 0x0a, 0xb1]));
  assert.equal(s, '00010ab1');
});

test('base64ToBytesFallback', () => {
  const u8 = utils.base64ToBytesFallback('AAEKsQ==');
  assert.deepEqual(u8, new Uint8Array([0x00, 0x01, 0x0a, 0xb1]));
});

test('u8toUBigInt', () => {
  assert.equal(utils.u8toUBigIntDV(new Uint8Array([])), 0x0n);
  assert.equal(utils.u8toUBigIntDV(new Uint8Array([1])), 0x1n);
  assert.equal(utils.u8toUBigIntDV(new Uint8Array([1, 2])), 0x0102n);
  assert.equal(
    utils.u8toUBigIntDV(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
    0x0102030405060708n
  );
  assert.equal(
    utils.u8toUBigIntDV(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])),
    0x010203040506070809n
  );
});

