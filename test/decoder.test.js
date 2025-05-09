import '../lib/types.js';
import * as cases from './cases.js';
import {CBORcontainer} from '../lib/container.js';
import {Tag} from '../lib/tag.js';
import assert from 'node:assert/strict';
import {decode} from '../lib/decoder.js';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';
import {unbox} from '../lib/box.js';

function testAll(list, opts, except) {
  let count = 0;
  for (const [orig, diag, commented] of list) {
    if (except && except.has(commented)) {
      continue;
    }
    const d = decode(cases.toBuffer(commented), opts);
    assert.deepEqual(d, orig, diag ?? commented);
    count++;
  }
  assert.equal(count, list.length);
}

function failAll(list, opts) {
  for (const c of list) {
    assert.throws(() => decode(cases.toBuffer(c), opts), c);
  }
}

test('good', () => {
  testAll(cases.good);
  testAll(cases.goodBoxed, {boxed: true});
});

test('decode good', () => {
  testAll(cases.decodeGood);
  testAll(cases.decodeGood, {rejectDuplicateKeys: true});
});

test('decode bad', () => {
  failAll(cases.decodeBad);
});

test('decode bad tags', () => {
  failAll(cases.decodeBadTags);
});

test('decode with cde', () => {
  testAll(cases.goodNumbers, {cde: true});
  testAll(cases.good.filter(([o]) => o instanceof Map), {cde: true});
  failAll([
    '0x1817',
    '0xc24101',
    '0xc2420001',
  ], {cde: true});
});

test('decode with dCBOR', () => {
  testAll(cases.good.filter(([o]) => o instanceof Map), {dcbor: true});

  failAll([
    '0xa280008001',
    '0xa200010002',
    '0x6345cc88',
  ], {dcbor: true});
});

test('goodEndian', () => {
  testAll(cases.goodEndian.map(([obj, little, _big]) => [obj, 'little', little]));
  testAll(cases.goodEndian.map(([obj, _little, big]) => [obj, 'big', big]));
});

test('depth', () => {
  assert.throws(() => decode('818180', {maxDepth: 1}));
});

test('types', () => {
  // Expects number
  assert.throws(() => decode('c16161'));

  // Expects string
  assert.throws(() => decode('d82200'));

  // Expects u8
  assert.throws(() => decode('d81800'));

  // Expects Array
  assert.throws(() => decode('d9010200'));

  // Odd buffer size for u16
  assert.throws(() => decode('d841450001000200'));

  // 33
  assert.deepEqual(decode('d82163415f2d'), hexToU8('03ff'));

  // 34
  assert.deepEqual(decode('d8226441414543'), hexToU8('000102'));

  // 72
  assert.deepEqual(
    decode('d84845ff0001807f'),
    new Int8Array([-1, 0, 1, -128, 127])
  );

  // 258
  assert.deepEqual(decode('d9010283010203'), new Set([1, 2, 3]));

  // 262
  assert.deepEqual(decode('d901066c7b2261223a2066616c73657d'), {a: false});

  // 273
  assert.deepEqual(decode('d9011143eda080'), '\ud800');

  // Always invalid
  assert.throws(() => decode('d9ffff00'));
  assert.throws(() => decode('daffffffff00'));
  assert.throws(() => decode('dbffffffffffffffff00'));
});

test('encodings', () => {
  decode('00', {encoding: 'hex'});
  decode('AA==', {encoding: 'base64'});

  assert.throws(() => decode('', {encoding: 'INVALID'}));
});

test('decode rejections', () => {
  failAll([
    '0xf97c00',
    '0xf97e00',
    '0xfada000000',
    '0xfb7fefffffffffffff',
  ], {rejectFloats: true});

  failAll([
    '0xc243000002',
  ], {rejectBigInts: true});

  failAll([
    '0x00',
    '0x20',
  ], {rejectInts: true});

  failAll([
    '0xa27f6161ff007f6161ff00', // Duplicate streaming keys
  ], {rejectDuplicateKeys: true});
});

test('unbox decoded', () => {
  for (const [hex, unboxed] of [
    ['80', []],
    ['8100', [0]],
    ['a10001', new Map([[0, 1]])],
    ['a1616102', {a: 2}],
    ['6161', 'a'],
    ['f4', false],
    ['c24102', 2n],
    ['c1fb41d9399f93ed6042', new Date(1692827215709)],
    ['c07818323032332d30382d32375431353a31383a35302e3839385a', new Date(1693149530898)],
  ]) {
    const d = decode(hexToU8(hex), {boxed: true});
    assert.deepEqual(unbox(d), unboxed);
  }
  failAll([
    '0xc000',
  ], {boxed: true});
  assert.equal(unbox(1), 1);
  assert.deepEqual(unbox(new Tag(1, Object(0))), new Tag(1, 0));
  assert.deepEqual(unbox({a: 1}), {a: 1});
});

test('rejectSubnormals', () => {
  failAll([
    '0xf90001',
    '0xf98001',
  ], {rejectSubnormals: true});
});

test('fail on old prefs', () => {
  assert.throws(
    () => decode('f93d00', {rejectLongNumbers: true}),
    /rejectLongNumbers has changed to requirePreferred/
  );
});

test('preferMap', () => {
  testAll([
    [new Map(), 'Map(0) {}', `0xa0
a0 -- Map (Length: 0 pairs)\n`],
    [new Map([['a', 'b']]), "Map(1) { 'a' => 'b' }", `0xa161616162
a1   -- Map (Length: 1 pair)
  61 --   [key 0] UTF8 (Length: 1): "a"
    61
  61 --   [val 0] UTF8 (Length: 1): "b"
    62\n`],
  ], {preferMap: true});
});

test('createObject', () => {
  testAll([
    [new Map(), 'Map(0) {}', `0xa0
a0 -- Map (Length: 0 pairs)\n`],
  ], {
    createObject(kvs, opts) {
      if (kvs.length === 0) {
        return new Map();
      }
      return CBORcontainer.defaultDecodeOptions.createObject(kvs, opts);
    },
  });
});
