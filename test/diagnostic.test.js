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
  for (const [_orig, _diag, commented] of list) {
    assert.throws(() => diagnose(toBuffer(commented)));
    count++;
  }
  assert.equal(count, list.length);
}

test('good diagnose', () => {
  testAll(good);
});

test('decode', () => {
  testAll(decodeGood);
});

test('edges', () => {
  failAll(decodeBad);
});
