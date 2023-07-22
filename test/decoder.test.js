import '../lib/types.js';
import * as cases from './cases.js';
import assert from 'node:assert/strict';
import {decode} from '../lib/decoder.js';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';

function testAll(list, opts) {
  let count = 0;
  for (const c of list) {
    const d = decode(cases.toBuffer(c), opts);
    assert.deepEqual(d, c[0], cases.toString(c));
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

  // Odd buffer size for u16
  assert.throws(() => decode('d841450001000200'));

  // 34
  assert.deepEqual(decode('d8226441414543'), hexToU8('000102'));

  // 72
  assert.deepEqual(
    decode('d84845ff0001807f'),
    new Int8Array([-1, 0, 1, -128, 127])
  );
});

test('encodings', () => {
  decode('00', {encoding: 'hex'});
  decode('AA==', {encoding: 'base64'});

  assert.throws(() => decode('', {encoding: 'INVALID'}));
});
