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
