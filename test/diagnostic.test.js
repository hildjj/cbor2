import '../lib/types.js';
import {decodeBad, decodeGood, good, toBuffer} from './cases.js';
import assert from 'node:assert/strict';
import {diagnose} from '../lib/diagnostic.js';
import test from 'node:test';

function testAll(list) {
  let count = 0;
  for (const [_orig, diag, commented] of list) {
    const d = diagnose(toBuffer(commented));
    assert.equal(d, diag, commented);
    count++;
  }
  assert.equal(count, list.length);
}

function failAll(list) {
  let count = 0;
  for (const hex of list) {
    assert.throws(() => diagnose(toBuffer(hex)), hex);
    count++;
  }
  assert.equal(count, list.length);
}

test('good diagnose', () => {
  testAll(good);
});

test('diagnose decodeGood ', () => {
  testAll(decodeGood);
});

test('diagnose decodeBad', () => {
  failAll(decodeBad);
});

test('diagnose encodings', () => {
  assert.equal(diagnose('AA==', {encoding: 'base64'}), '0');
});
