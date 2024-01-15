import '../lib/types.js';
import * as cases from './cases.js';
import {MT, SYMS} from '../lib/constants.js';
import {
  clearEncoder, encode, registerEncoder, writeInt,
} from '../lib/encoder.js';
import {isBigEndian, u8toHex} from '../lib/utils.js';
import {sortCoreDeterministic, sortLengthFirstDeterministic} from '../lib/sorts.js';
import {Writer} from '../lib/writer.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import util from 'node:util';

export const dCBORencodeOptions = {
  // Default: collapseBigInts: true,
  ignoreOriginalEncoding: true,
  largeNegativeAsBigInt: true,
  rejectCustomSimples: true,
  rejectDuplicateKeys: true,
  rejectUndefined: true,
  simplifyNegativeZero: true,
  sortKeys: sortCoreDeterministic,
};

const BE = isBigEndian();

function testAll(list, opts = undefined) {
  let len = 0;
  for (const [orig, diag, commented] of list) {
    try {
      const actual = u8toHex(encode(orig, opts));
      const expected = cases.toString(commented);
      assert.equal(actual, expected, diag);
      len++;
    } catch (e) {
      e.message = `Error encoding ${util.inspect(orig)} (${commented}): ${e.message}`;
      throw e;
    }
  }
  assert.equal(len, list.length);
}

function failAll(list, opts) {
  for (const c of list) {
    assert.throws(() => encode(c, opts), util.inspect(c));
  }
}

test('good encode', () => {
  testAll(cases.good);
  testAll(cases.encodeGood);
  testAll(cases.goodBoxed, {boxed: true});
});

test('bad encode', () => {
  failAll(cases.badBoxed);
});

test('collapseBigIntegers', () => {
  testAll(cases.collapseBigIntegers);
  for (const [val, bi] of cases.collapseBigIntegers) {
    const actual = u8toHex(encode(val, {collapseBigInts: false}));
    const expected = cases.toString(bi);
    assert.equal(actual, expected, 'not collapsed');
  }
});

test('good endian encode', () => {
  testAll(cases.goodEndian.map(([obj, little]) => [obj, 'little', little]), {forceEndian: true});
  testAll(cases.goodEndian.map(([obj, _little, big]) => [obj, 'big', big]), {forceEndian: false});
  if (BE) {
    testAll(cases.goodEndian.map(([obj, _little, big]) => [obj, 'big', big]));
  } else {
    testAll(cases.goodEndian.map(([obj, little]) => [obj, 'little', little]));
  }
});

test('clear type', () => {
  const t = new cases.TempClass(1);
  assert.equal(u8toHex(encode(t)), 'd9fffe01');
  assert.equal(registerEncoder(cases.TempClass, (obj, w, opts) => {
    w.writeUint8(0);
    return SYMS.DONE;
  }), undefined);
  assert.equal(u8toHex(encode(t)), '00');
  assert.notEqual(clearEncoder(cases.TempClass), undefined);
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

test('encode dCBOR', () => {
  failAll(cases.encodeBadDCBOR, dCBORencodeOptions);
  testAll(cases.good.filter(([o]) => o instanceof Map), dCBORencodeOptions);
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, NaN);
  dv.setUint8(3, 1);
  const n = dv.getFloat32(0); // NaN with extra bits set.
  testAll([
    [-0, '', '0x00'], // -0 -> 0
    [n, '', '0xf97e00'],
    [-0x8000000000000000n, '', '0x3b7fffffffffffffff'],
    [-0x8000000000000001n, '', '0xc3488000000000000000'],
  ], dCBORencodeOptions);
});

test('encode rejections', () => {
  failAll([
    2n,
    -2n,
  ], {collapseBigInts: false, rejectBigInts: true});
  failAll([
    2.1,
    -2.1,
  ], {rejectFloats: true});
});

test('encode avoiding ints', () => {
  testAll([
    [0, '', '0xf90000'],
    [-0, '', '0xf98000'],
    [2, '', '0xf94000'],
    [-2, '', '0xf9c000'],
  ], {avoidInts: true});

  testAll([
    [0, '', '0xf90000'],
    [-0, '', '0xf90000'],
  ], {avoidInts: true, simplifyNegativeZero: true});
});

test('flush to zero', () => {
  testAll([
    [1e-320, '', '0x00'],
    [-1e-320, '', '0xf98000'],
    [Number.EPSILON, '', '0xfa25800000'],
    [-Number.EPSILON, '', '0xfaa5800000'],
  ], {flushToZero: true});
});
