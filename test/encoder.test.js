import '../lib/types.js';
import {MT, SYMS} from '../lib/constants.js';
import {
  TempClass, collapseBigIntegers, encodeGood, good, goodEndian, toString,
} from './cases.js';
import {
  clearEncoder, encode, registerEncoder, sortLengthFirstDeterministic, writeInt,
} from '../lib/encoder.js';
import {isBigEndian, u8toHex} from '../lib/utils.js';
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
  assert.equal(u8toHex(encode(t)), 'd9fffe01');
  assert.equal(registerEncoder(TempClass, (obj, w, opts) => {
    w.writeUint8(0);
    return SYMS.DONE;
  }), undefined);
  assert.equal(u8toHex(encode(t)), '00');
  assert.notEqual(clearEncoder(TempClass), undefined);
  assert.equal(u8toHex(encode(t)), 'd9fffe01');
});

test('toJSON', () => {
  class Temp {
    // eslint-disable-next-line class-methods-use-this
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
  assert.throws(() => writeInt(-1, w, MT.ARRAY));
  assert.throws(() => encode(Symbol('UNKNOWN')));
  assert.throws(() => encode(() => {
    // Blank
  }));
  assert.throws(() => encode(new ArrayBuffer(8)));
  assert.throws(() => encode(new SharedArrayBuffer(8)));
  assert.throws(() => encode(new DataView(new ArrayBuffer(8))));
});

test('deterministic sorting', () => {
  let k = 0;
  const m = new Map([
    [10, k++],
    [100, k++],
    [-1, k++],
    ['z', k++],
    ['aa', k++],
    [[100], k++],
    [[-1], k++],
    [false, k++],
  ]);
  assert.equal(
    u8toHex(encode(m)),
    'a80a001864012002617a036261610481186405812006f407'
  );
  assert.equal(
    u8toHex(encode(m, {sortKeys: sortLengthFirstDeterministic})),
    'a80a002002f407186401617a038120066261610481186405'
  );
  assert.equal(
    u8toHex(encode(
      new Map([[[], 0], [[], 1]]),
      {sortKeys: sortLengthFirstDeterministic}
    )),
    'a280008001'
  );
});
