import {checkSubnormal, flushToZero, halfToUint} from '../lib/float.js';
import assert from 'node:assert/strict';
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

test('checkSubnormal', () => {
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  function numBuf(n, bytes) {
    switch (bytes) {
      case 2:
        dv.setUint16(0, halfToUint(n));
        return buf.subarray(0, 2);
      case 4:
        dv.setFloat32(0, n, false);
        return buf.subarray(0, 4);
      case 8:
        dv.setFloat64(0, n, false);
        return buf.subarray(0, 8);
    }
    throw new Error('Invalid state');
  }

  assert.throws(() => checkSubnormal(numBuf(0.000000059604645, 2)));
  assert.throws(() => checkSubnormal(numBuf(-0.000000059604645, 2)));
  assert.throws(() => checkSubnormal(numBuf(1e-45, 4)));
  assert.throws(() => checkSubnormal(numBuf(1e-320, 8)));
  assert.throws(() => checkSubnormal(new Uint8Array(9)));
  assert.throws(() => checkSubnormal(new Uint8Array(3)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(0, 2)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(-0, 2)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(0, 4)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(-0, 4)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(0, 8)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(-0, 8)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(Number.EPSILON, 8)));
  assert.doesNotThrow(() => checkSubnormal(numBuf(-Number.EPSILON, 8)));
});
