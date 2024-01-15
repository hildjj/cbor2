import assert from 'node:assert/strict';
import {flushToZero} from '../lib/float.js';
import test from 'node:test';

test('flushToZero', () => {
  assert.equal(flushToZero(0), 0);
  assert.equal(flushToZero(-0), -0);
  assert.equal(flushToZero(1), 1);
  assert.equal(flushToZero(1.25), 1.25);
  assert.equal(flushToZero(-1), -1);
  assert.equal(flushToZero(-1.25), -1.25);
  assert.equal(flushToZero(Number.EPSILON), Number.EPSILON);
  assert.equal(flushToZero(-Number.EPSILON), -Number.EPSILON);
  assert.notEqual(0, 1e-320);
  assert.equal(flushToZero(1e-320), 0);
  assert.equal(flushToZero(-1e-320), -0);
});
