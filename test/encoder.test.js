import '../lib/types.js';
import * as cases from './cases.js';
import {MT, SYMS} from '../lib/constants.js';
import {
  clearEncoder, encode, encodedNumber, registerEncoder, writeInt,
} from '../lib/encoder.js';
import {isBigEndian, u8toHex} from '../lib/utils.js';
import {Writer} from '../lib/writer.js';
import assert from 'node:assert/strict';
import {sortLengthFirstDeterministic} from '../lib/sorts.js';
import test from 'node:test';
import util from 'node:util';

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
  assert.equal(registerEncoder(cases.TempClass, (_obj, w, _opts) => {
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

test('encode cde', () => {
  testAll([
    [new Map([[100, 0], [10, 1]]), '', '0xa20a01186400'],
  ], {cde: true});
});

test('encode dCBOR', () => {
  testAll(cases.good.filter(([o]) => o instanceof Map), {dcbor: true});
  testAll([
    [-0x8000000000000000n, '', '0x3b7fffffffffffffff'],
    [-0x8000000000000001n, '', '0xc3488000000000000000'],
  ], {dcbor: true});
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

test('encodedNumber', () => {
  testAll([
    [encodedNumber(0, 'bigint'), '', '0xc24100'],
    [encodedNumber(0n, 'bigint'), '', '0xc24100'],
    [encodedNumber(1, 'bigint'), '', '0xc24101'],
    [encodedNumber(1n, 'bigint'), '', '0xc24101'],
    [encodedNumber(-1, 'bigint'), '', '0xc34100'],
    [encodedNumber(-1n, 'bigint'), '', '0xc34100'],

    [encodedNumber(0, 'f'), '', '0xf90000'],
    [encodedNumber(1, 'f'), '', '0xf93c00'],
    [encodedNumber(-1, 'f'), '', '0xf9bc00'],
    [encodedNumber(0n, 'f'), '', '0xf90000'],
    [encodedNumber(1n, 'f'), '', '0xf93c00'],
    [encodedNumber(-1n, 'f'), '', '0xf9bc00'],
    [encodedNumber(NaN, 'f'), '', '0xf97e00'],
    [encodedNumber(-0, 'f'), '', '0xf98000'],
    [encodedNumber(Infinity, 'f'), '', '0xf97c00'],
    [encodedNumber(-Infinity, 'f'), '', '0xf9fc00'],
    [encodedNumber(2.25), '', '0xf94080'],
    [encodedNumber(2.1), '', '0xfb4000cccccccccccd'],

    [encodedNumber(0, 'f16'), '', '0xf90000'],
    [encodedNumber(1, 'f16'), '', '0xf93c00'],
    [encodedNumber(-1, 'f16'), '', '0xf9bc00'],
    [encodedNumber(0n, 'f16'), '', '0xf90000'],
    [encodedNumber(1n, 'f16'), '', '0xf93c00'],
    [encodedNumber(-1n, 'f16'), '', '0xf9bc00'],
    [encodedNumber(NaN, 'f16'), '', '0xf97e00'],
    [encodedNumber(-0, 'f16'), '', '0xf98000'],
    [encodedNumber(Infinity, 'f16'), '', '0xf97c00'],
    [encodedNumber(-Infinity, 'f16'), '', '0xf9fc00'],

    [encodedNumber(0, 'f32'), '', '0xfa00000000'],
    [encodedNumber(1, 'f32'), '', '0xfa3f800000'],
    [encodedNumber(-1, 'f32'), '', '0xfabf800000'],
    [encodedNumber(0n, 'f32'), '', '0xfa00000000'],
    [encodedNumber(1n, 'f32'), '', '0xfa3f800000'],
    [encodedNumber(-1n, 'f32'), '', '0xfabf800000'],
    [encodedNumber(NaN, 'f32'), '', '0xfa7fc00000'],
    [encodedNumber(-0, 'f32'), '', '0xfa80000000'],
    [encodedNumber(Infinity, 'f32'), '', '0xfa7f800000'],
    [encodedNumber(-Infinity, 'f32'), '', '0xfaff800000'],

    [encodedNumber(0, 'f64'), '', '0xfb0000000000000000'],
    [encodedNumber(1, 'f64'), '', '0xfb3ff0000000000000'],
    [encodedNumber(-1, 'f64'), '', '0xfbbff0000000000000'],
    [encodedNumber(0n, 'f64'), '', '0xfb0000000000000000'],
    [encodedNumber(1n, 'f64'), '', '0xfb3ff0000000000000'],
    [encodedNumber(-1n, 'f64'), '', '0xfbbff0000000000000'],
    [encodedNumber(NaN, 'f64'), '', '0xfb7ff8000000000000'],
    [encodedNumber(-0, 'f64'), '', '0xfb8000000000000000'],
    [encodedNumber(Infinity, 'f64'), '', '0xfb7ff0000000000000'],
    [encodedNumber(-Infinity, 'f64'), '', '0xfbfff0000000000000'],

    [encodedNumber(0, 'i'), '', '0x00'],
    [encodedNumber(1, 'i'), '', '0x01'],
    [encodedNumber(-1, 'i'), '', '0x20'],
    [encodedNumber(0xffffffffffffffffn, 'i'), '', '0x1bffffffffffffffff'],
    [encodedNumber(0xffffffffffffffffn + 1n, 'i'), '', '0xc249010000000000000000'],
    [encodedNumber(-0xffffffffffffffffn - 1n, 'i'), '', '0x3bffffffffffffffff'],
    [encodedNumber(-0xffffffffffffffffn - 2n, 'i'), '', '0xc349010000000000000000'],
    [encodedNumber(0, 'i', MT.TAG), '', '0xc0'],
    [encodedNumber(18014398509481984n, 'i', MT.TAG), '', '0xdb0040000000000000'],

    [encodedNumber(0, 'i0'), '', '0x00'],
    [encodedNumber(1, 'i0'), '', '0x01'],
    [encodedNumber(-1, 'i0'), '', '0x20'],
    [encodedNumber(0, 'i0', MT.TAG), '', '0xc0'],

    [encodedNumber(0, 'i8'), '', '0x1800'],
    [encodedNumber(1, 'i8'), '', '0x1801'],
    [encodedNumber(-1, 'i8'), '', '0x3800'],
    [encodedNumber(0n, 'i8'), '', '0x1800'],
    [encodedNumber(1n, 'i8'), '', '0x1801'],
    [encodedNumber(-1n, 'i8'), '', '0x3800'],

    [encodedNumber(0, 'i16'), '', '0x190000'],
    [encodedNumber(1, 'i16'), '', '0x190001'],
    [encodedNumber(-1, 'i16'), '', '0x390000'],
    [encodedNumber(0n, 'i16'), '', '0x190000'],
    [encodedNumber(1n, 'i16'), '', '0x190001'],
    [encodedNumber(-1n, 'i16'), '', '0x390000'],

    [encodedNumber(0, 'i32'), '', '0x1a00000000'],
    [encodedNumber(1, 'i32'), '', '0x1a00000001'],
    [encodedNumber(-1, 'i32'), '', '0x3a00000000'],
    [encodedNumber(0n, 'i32'), '', '0x1a00000000'],
    [encodedNumber(1n, 'i32'), '', '0x1a00000001'],
    [encodedNumber(-1n, 'i32'), '', '0x3a00000000'],

    [encodedNumber(0, 'i64'), '', '0x1b0000000000000000'],
    [encodedNumber(1, 'i64'), '', '0x1b0000000000000001'],
    [encodedNumber(-1, 'i64'), '', '0x3b0000000000000000'],
    [encodedNumber(0n, 'i64'), '', '0x1b0000000000000000'],
    [encodedNumber(1n, 'i64'), '', '0x1b0000000000000001'],
    [encodedNumber(-1n, 'i64'), '', '0x3b0000000000000000'],
    [encodedNumber(0xffffffffffffffffn, 'i64'), '', '0x1bffffffffffffffffn'],
    [encodedNumber(-0xffffffffffffffffn, 'i64'), '', '0x3bfffffffffffffffe'],
    [encodedNumber(-0xffffffffffffffffn - 1n, 'i64'), '', '0x3bffffffffffffffff'],
  ]);

  [
    [1.1, 'bigint'],
    [-1.1, 'bigint'],
    [NaN, 'bigint'],
    [Infinity, 'bigint'],
    [-Infinity, 'bigint'],
    [-0, 'bigint'],

    [12345678, 'f16'],
    [123456789, 'f32'],
    [12345678n, 'f16'],
    [123456789n, 'f32'],
    [0xffffffffffffffffn + 1n, 'i64'],
    [-0xffffffffffffffffn - 2n, 'i64'],

    [-0, 'i'],

    [-0, 'i8'],
    [Infinity, 'i8'],
    [-Infinity, 'i8'],
    [NaN, 'i8'],

    [-0, 'i16'],
    [Infinity, 'i16'],
    [-Infinity, 'i16'],
    [NaN, 'i16'],

    [-0, 'i32'],
    [Infinity, 'i32'],
    [-Infinity, 'i32'],
    [NaN, 'i32'],

    [-0, 'i64'],
    [Infinity, 'i64'],
    [-Infinity, 'i64'],
    [NaN, 'i64'],

    [0, 'INVALID'],
    [-1, 'i0', MT.TAG],
  ].forEach(([value, encoding, mt]) => assert.throws(
    () => encodedNumber(value, encoding, mt),
    util.inspect({value, encoding, mt})
  ));
});

test('wtf8', () => {
  testAll([
    ['\ud800', 'Invalid UTF encoded as WTF8', '0xd9011143eda080'],
  ], {wtf8: true});
});
