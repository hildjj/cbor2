import '../lib/types.js';
import {
  TempClass, collapseBigIntegers, encodeGood, good, goodEndian, toString,
} from './cases.js';
import {addType, clearType, encode, writeInt} from '../lib/encoder.js';
import {isBigEndian, u8toHex} from '../lib/utils.js';
import {MT} from '../lib/constants.js';
import {Writer} from '../lib/writer.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const BE = isBigEndian();

function testAll(list, opts = undefined) {
  let len = 0;
  for (const [orig, diag, commented] of list) {
    const actual = u8toHex(encode(orig, opts));
    const expected = toString(commented);
    assert.equal(actual, expected, diag);
    len++;
  }
  assert.equal(len, list.length);
}

test('good encode', () => {
  testAll(good);
  testAll(encodeGood);
});

test('collapseBigIntegers', () => {
  testAll(collapseBigIntegers);
  for (const [val, bi] of collapseBigIntegers) {
    const actual = u8toHex(encode(val, {collapseBigInts: false}));
    const expected = toString(bi);
    assert.equal(actual, expected, 'not collapsed');
  }
});

test('good endian encode', () => {
  testAll(goodEndian.map(([obj, little]) => [obj, 'little', little]), {forceEndian: true});
  testAll(goodEndian.map(([obj, _little, big]) => [obj, 'big', big]), {forceEndian: false});
  if (BE) {
    testAll(goodEndian.map(([obj, _little, big]) => [obj, 'big', big]));
  } else {
    testAll(goodEndian.map(([obj, little]) => [obj, 'little', little]));
  }
});

test('clear type', () => {
  const t = new TempClass(1);
  assert.equal(u8toHex(encode(t)), 'd9fffef7');
  assert.equal(addType(TempClass, (w, obj, opts) => {
    w.writeUint8(0);
  }), undefined);
  assert.equal(u8toHex(encode(t)), '00');
  assert.notEqual(clearType(TempClass), undefined);
  assert.equal(u8toHex(encode(t)), 'd9fffef7');
});

test('toJSON', () => {
  class Temp {
    toJSON() {
      return {foo: true};
    }
  }
  const t = new Temp();
  assert.equal(JSON.stringify(t), '{"foo":true}');
  assert.equal(u8toHex(encode(t)), 'a163666f6ff5');
});

test('encoder edges', () => {
  const w = new Writer();
  assert.throws(() => writeInt(w, -1, MT.ARRAY));
  assert.throws(() => encode(Symbol('UNKNOWN')));
  assert.throws(() => encode(() => {
    // Blank
  }));
  assert.throws(() => encode(new ArrayBuffer(8)));
  assert.throws(() => encode(new SharedArrayBuffer(8)));
  assert.throws(() => encode(new DataView(new ArrayBuffer(8))));
});
