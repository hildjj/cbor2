import '../lib/types.js';
import * as cases from './cases.js';
import {CBORcontainer} from '../lib/container.js';
import {NAN} from '../lib/float.js';
import {TAG} from '../lib/constants.js';
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

test('unexpected BREAK', () => {
  // BREAK is only valid to close an indefinite-length byte string, text
  // string, array or map.  Anywhere else, it must be rejected.

  // BREAK on its own.
  assert.throws(() => decode('ff'), /Unexpected BREAK/);

  // BREAK in a definite-length array: [BREAK].
  assert.throws(() => decode('81ff'), /Unexpected BREAK/);

  // BREAK as a definite-length map key: {BREAK: 0}.
  assert.throws(() => decode('a1ff00'), /Unexpected BREAK/);

  // BREAK as a definite-length map value: {0: BREAK}.
  assert.throws(() => decode('a100ff'), /Unexpected BREAK/);

  // BREAK as tag content: 1(BREAK).
  assert.throws(() => decode('c1ff'), /Unexpected BREAK/);

  // BREAK in a definite-length array inside an indefinite-length array:
  // [_ [BREAK]].
  assert.throws(() => decode('9f81ffff'), /Unexpected BREAK/);

  // BREAK in a definite-length map inside an indefinite-length array:
  // [_ {BREAK: 0}].
  assert.throws(() => decode('9fa1ff00ff'), /Unexpected BREAK/);

  // BREAK as tag content inside an indefinite-length array: [_ 1(BREAK)].
  assert.throws(() => decode('9fc1ffff'), /Unexpected BREAK/);

  // BREAK in place of a value in an indefinite-length map: {_ 0: BREAK}.
  assert.throws(() => decode('bf00ff'), /Missing map value/);
  assert.throws(() => decode('bf000103ff'), /Missing map value/);

  // Data after the BREAK that closes the top-level item.
  assert.throws(() => decode('5f40ff00'), /Extra data in input/);
});

test('valid BREAK', () => {
  // Empty indefinite-length byte string: (_ ).
  assert.deepEqual(decode('5fff'), new Uint8Array(0));

  // Empty indefinite-length text string: (_ ).
  assert.equal(decode('7fff'), '');

  // Empty indefinite-length array: [_ ].
  assert.deepEqual(decode('9fff'), []);

  // Empty indefinite-length map: {_ }.
  assert.deepEqual(decode('bfff'), {});

  // Nested empty indefinite-length arrays: [_ [_ ]].
  assert.deepEqual(decode('9f9fffff'), [[]]);

  // Empty indefinite-length map inside an indefinite-length map:
  // {_ "a": {_ }}.
  assert.deepEqual(decode('bf6161bfffff'), {a: {}});
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
    '0xFB7FF0000000000001', // Not shortest
  ], {dcbor: true});
});

test('goodEndian', () => {
  testAll(cases.goodEndian.map(([obj, little, _big]) => [obj, 'little', little]));
  testAll(cases.goodEndian.map(([obj, _little, big]) => [obj, 'big', big]));
});

test('depth', () => {
  // Definite array: [[]] is allowed, [[[]]] is too deep.
  assert.doesNotThrow(() => decode('8180', {maxDepth: 1}));
  assert.throws(() => decode('818180', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Definite array with leaf: [0] is allowed, [[0]] is too deep.
  assert.doesNotThrow(() => decode('8100', {maxDepth: 1}));
  assert.throws(() => decode('818100', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Indefinite array: [_ 0] is allowed, [_ [_ 0]] is too deep.
  assert.doesNotThrow(() => decode('9f00ff', {maxDepth: 1}));
  assert.throws(() => decode('9f9f00ffff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Definite map, nesting key: {{}: 0} is allowed, {{{}: 0}: 0} is too deep.
  assert.doesNotThrow(() => decode('a1a000', {maxDepth: 1}));
  assert.throws(() => decode('a1a1a00000', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Definite map, nesting value: {0: {}} is allowed, {0: {0: {}}} is too deep.
  assert.doesNotThrow(() => decode('a100a0', {maxDepth: 1}));
  assert.throws(() => decode('a100a100a0', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Indefinite map: {_ 0: 0} is allowed, {_ {_ 0: 0}: 0} is too deep.
  assert.doesNotThrow(() => decode('bf0000ff', {maxDepth: 1}));
  assert.throws(() => decode('bfbf0000ff00ff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Tag: 1(0) is allowed, 1(1(0)) is too deep.
  assert.doesNotThrow(() => decode('c100', {maxDepth: 1}));
  assert.throws(() => decode('c1c100', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Mixed containers.
  assert.doesNotThrow(() => decode('81a10080', {maxDepth: 2}));
  assert.throws(() => decode('81a1008100', {maxDepth: 2}), /Maximum depth/);

  // A maxDepth of 0 only allows a top-level item.
  assert.doesNotThrow(() => decode('80', {maxDepth: 0}));
  assert.doesNotThrow(() => decode('00', {maxDepth: 0}));
  assert.throws(() => decode('8100', {maxDepth: 0}), /Maximum depth 0/);

  // Exactly maxDepth levels of nested arrays.
  const nested = (n, leaf = '80') => '81'.repeat(n) + leaf;
  assert.doesNotThrow(() => decode(nested(10), {maxDepth: 10}));
  assert.throws(() => decode(nested(11), {maxDepth: 10}), /Maximum depth/);
});

test('BREAK does not count toward maxDepth', () => {
  // The BREAK that closes an indefinite-length item is not a data item
  // (RFC 8949, section 3.2.1), so it must not count toward maxDepth.  An
  // empty indefinite-length item is allowed wherever its definite-length
  // equivalent is.

  // Empty indefinite byte string: (_ ).
  assert.doesNotThrow(() => decode('5fff', {maxDepth: 0}));

  // Empty indefinite text string: (_ ).
  assert.doesNotThrow(() => decode('7fff', {maxDepth: 0}));

  // Empty indefinite array: [_ ] is allowed, [_ 0] is too deep.
  assert.doesNotThrow(() => decode('9fff', {maxDepth: 0}));
  assert.throws(() => decode('9f00ff', {maxDepth: 0}), /Maximum depth 0 exceeded/);

  // Empty indefinite map: {_ } is allowed, {_ 0: 0} is too deep.
  assert.doesNotThrow(() => decode('bfff', {maxDepth: 0}));
  assert.throws(() => decode('bf0000ff', {maxDepth: 0}), /Maximum depth 0 exceeded/);

  // Indefinite items with a leaf: [_ 0] and {_ 0: 0}.
  assert.doesNotThrow(() => decode('9f00ff', {maxDepth: 1}));
  assert.doesNotThrow(() => decode('bf0000ff', {maxDepth: 1}));

  // Inside a definite array: [[_ ]] is allowed, [[_ 0]] is too deep.
  assert.doesNotThrow(() => decode('819fff', {maxDepth: 1}));
  assert.throws(() => decode('819f00ff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Inside an indefinite array: [_ [_ ]] is allowed, [_ [_ 0]] is too deep.
  assert.doesNotThrow(() => decode('9f9fffff', {maxDepth: 1}));
  assert.throws(() => decode('9f9fffff', {maxDepth: 0}), /Maximum depth 0 exceeded/);
  assert.throws(() => decode('9f9f00ffff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // As a definite map key and value: {[_ ]: 0} and {0: [_ ]}.
  assert.doesNotThrow(() => decode('a19fff00', {maxDepth: 1}));
  assert.doesNotThrow(() => decode('a1009fff', {maxDepth: 1}));

  // As an indefinite map key and value: {_ [_ ]: 0} and {_ 0: {_ }}.
  // {_ 0: {_ 0: 0}} is too deep.
  assert.doesNotThrow(() => decode('bf9fff00ff', {maxDepth: 1}));
  assert.doesNotThrow(() => decode('bf00bfffff', {maxDepth: 1}));
  assert.throws(() => decode('bf00bf0000ffff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // As content of an unregistered tag: 9999([_ ]) is allowed,
  // 9999([_ 0]) is too deep.
  assert.doesNotThrow(() => decode('d9270f9fff', {maxDepth: 1}));
  assert.throws(() => decode('d9270f9f00ff', {maxDepth: 1}), /Maximum depth 1 exceeded/);

  // Three nested empty indefinite arrays: [_ [_ [_ ]]].
  assert.doesNotThrow(() => decode('9f9f9fffffff', {maxDepth: 2}));
  assert.throws(() => decode('9f9f9fffffff', {maxDepth: 1}), /Maximum depth 1 exceeded/);
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

  // 280
  assert.equal(decode('d90118636b6579'), Symbol.for('key'));
  assert.equal(decode('d9011881636b6579'), Symbol.for('key'));

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

test('wtf8 decode', () => {
  testAll([
    ['\ud800', '', '0xd9011143eda080'],
  ], {wtf8: true});
});

test('local tags decode', () => {
  assert.equal(
    decode('daffffffff00', {
      // Override the "never valid" tag to return "foo"
      tags: new Map([[4294967295, () => 'foo']]),
    }),
    'foo'
  );
});

test('ignoreGlobalTags', () => {
  testAll([
    [new Tag(TAG.REGEXP, ['foo', '']), '', 'd9524a8263666f6f60'],
  ], {ignoreGlobalTags: true});
});

test('keep nan payloads', () => {
  testAll([
    [new NAN(-0), '', 'f9fe00'],
  ], {keepNanPayloads: true});
  failAll([
    '0xFB7FF1000000000000',
  ], {rejectLongFloats: true, keepNanPayloads: true});
});

test('preferBigInt', () => {
  testAll([
    [1n, '', '0x01'],
    [-1n, '', '0x20'],
    [BigInt(Number.MAX_SAFE_INTEGER), '', '0x1b001fffffffffffff'],
    [BigInt(Number.MAX_SAFE_INTEGER) + 1n, '', '0x1b0020000000000000'],
    [BigInt(Number.MIN_SAFE_INTEGER), '', '0x3b001ffffffffffffe'],
    [BigInt(Number.MIN_SAFE_INTEGER) - 1n, '', '0x3b001fffffffffffff'],
    [BigInt(Number.MIN_SAFE_INTEGER) - 2n, '', '0x3b0020000000000000'],
  ], {preferBigInt: true});
});

test('DATE_EPOCH_DAYS', () => {
  testAll([
    [new Date(1363824000000), '', '0xd864193da9'],
    [new Date('1940-10-09'), '', '0xd8643929b3'],
    [new Date('1980-12-08'), '', '0xd864190f9a'],
  ], {dateTag: TAG.DATE_EPOCH_DAYS});
});

test('DATE_FULL', () => {
  testAll([
    [new Date(1363824000000), '', '0xd903ec6a323031332d30332d3231'],
    [new Date('1940-10-09'), '', '0xd903ec6a313934302d31302d3039'],
    [new Date('1980-12-08'), '', '0xd903ec6a313938302d31322d3038'],
  ], {dateTag: TAG.DATE_FULL});
});

test('collapseBigInts', () => {
  testAll([
    [0, '', '0xc240'],
    [0, '', '0xc24100'],
    [2, '', '0xc243000002'],
    [18446744073709551616n, '', '0xc249010000000000000000'],
  ], {collapseBigInts: true});
});

test('maxBigIntBytes', () => {
  assert.throws(() => decode('c24101', {maxBigIntBytes: -1}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: -Infinity}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: 'foo'}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: NaN}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: -0}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: 1.1}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: 1e300}));
  assert.throws(() => decode('c24101', {maxBigIntBytes: 0}));
});
