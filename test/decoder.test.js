import '../lib/types.js';
import * as cases from './cases.js';
import assert from 'node:assert/strict';
import {decode} from '../lib/decoder.js';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';

function testAll(list, opts) {
  let count = 0;
  for (const [orig, diag, commented] of list) {
    const d = decode(cases.toBuffer(commented), opts);
    assert.deepEqual(d, orig, diag);
    count++;
  }
  assert.equal(count, list.length);
}

function failAll(list) {
  for (const c of list) {
    assert.throws(() => decode(cases.toBuffer(c)));
  }
}

test('good', () => {
  testAll(cases.good);
});

test('decode', () => {
  testAll(cases.decodeGood);
});

test('edges', () => {
  failAll(cases.decodeBad);
});

test('goodEndian', () => {
  testAll(cases.goodEndian.map(([obj, little, big]) => [obj, 'little', little]));
  testAll(cases.goodEndian.map(([obj, little, big]) => [obj, 'big', big]));
});

test('depth', () => {
  assert.throws(() => decode('818180', {max_depth: 1}));
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
