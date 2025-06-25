import {NAN, checkSubnormal, flushToZero, halfToUint} from '../lib/float.js';
import assert from 'node:assert/strict';
import {decode} from '../lib/decoder.js';
import {encode} from '../lib/encoder.js';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';
import util from 'node:util';

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

test('NAN', () => {
  const n2 = new NAN(1, true, 1);
  assert.equal(n2.sign, 1);
  assert.equal(n2.payload, 1);
  assert.equal(n2.quiet, true);
  assert.deepEqual(n2.bytes, hexToU8('f97e01'));
  assert.equal(n2.isShortestEncoding, true);
  assert.equal(Number(n2), NaN);
  assert.deepEqual(encode(n2), hexToU8('f97e01'));
  assert.equal(n2.toString(), 'NaN(1)');
  assert.equal(decode(hexToU8('f97e01'), {keepNanPayloads: true}).constructor, NAN);
  assert.equal(decode(hexToU8('f97e00'), {keepNanPayloads: true}), NaN);
  assert.equal(decode(hexToU8('f97e01'), {keepNanPayloads: false}), NaN);

  const n4 = new NAN(-1, true, 0x200);
  assert.equal(n4.sign, -1);
  assert.equal(n4.payload, 0x200);
  assert.equal(n4.quiet, true);
  assert.equal(n4.isShortestEncoding, true);
  assert.deepEqual(n4.bytes, hexToU8('faffc00200'));
  assert.equal(Number(n4), NaN);
  assert.deepEqual(encode(n4), hexToU8('faffc00200'));
  assert.equal(n4.toString(), '-NaN(512)');

  const n8 = new NAN(1, false, 0x400000);
  assert.equal(n8.sign, 1);
  assert.equal(n8.payload, 0x400000);
  assert.equal(n8.quiet, false);
  assert.equal(n8.isShortestEncoding, true);
  assert.deepEqual(n8.bytes, hexToU8('FB7FF0000000400000'));
  assert.equal(Number(n8), NaN);
  assert.deepEqual(encode(n8), hexToU8('FB7FF0000000400000'));
  assert.equal(n8.toString(), 'NaN(!4194304)');
  assert.equal(util.inspect(n8), 'NaN(!4194304)');

  assert.equal(new NAN(1, true, 0x400000).toString(), 'NaN(4194304)');
  assert.equal(new NAN(hexToU8('FB7FF0000000000001')).isShortestEncoding, false);

  assert.throws(() => new NAN(2, true, 1));
  assert.throws(() => new NAN(-1, '', 1));
  assert.throws(() => new NAN(-1, false));
  assert.throws(() => new NAN(-1, false, 0x8000000000000));
  assert.throws(() => new NAN(new Uint8Array()));
});
