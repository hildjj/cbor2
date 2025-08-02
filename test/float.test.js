import {NAN, NAN_SIZE, checkSubnormal, flushToZero, halfToUint} from '../lib/float.js';
import {hexToU8, u8toHex} from '../lib/utils.js';
import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import {decode} from '../lib/decoder.js';
import {encode} from '../lib/encoder.js';
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
  const n2 = new NAN(-0x100000000000);
  assert.equal(n2.sign, -1);
  assert.equal(n2.payload, -0x100000000000);
  assert.equal(n2.quiet, true);
  assert.equal(n2.isShortestEncoding, true);
  assert.deepEqual(n2.bytes, hexToU8('f9fe04'));
  assert.equal(Number(n2), NaN);
  assert.deepEqual(encode(n2), hexToU8('f9fe04'));
  assert.equal(n2.toString(), "nan'-17592186044416'_1");
  assert.equal(n2.toString(2), "nan'-0b100000000000000000000000000000000000000000000'_1");
  assert.equal(n2.toString(8), "nan'-0o400000000000000'_1");
  assert.equal(n2.toString(10), "nan'-17592186044416'_1");
  assert.equal(n2.toString(16), "nan'-0x100000000000'_1");
  assert.equal(util.inspect(n2), "nan'-17592186044416'_1");
  assert.deepEqual(encode(new NAN(0x100000000000, false, NAN_SIZE.F16)), hexToU8('f97c04'));
  assert.deepEqual(encode(new NAN(0x100000000000, false, NAN_SIZE.F32)), hexToU8('fa7f808000'));
  assert.deepEqual(encode(new NAN(0x100000000000, false, NAN_SIZE.F64)), hexToU8('fb7ff0100000000000'));
  assert.equal(new NAN(0xfe04n).payload, -0x100000000000);
  assert.equal(new NAN(0xfe04n).size, NAN_SIZE.F16);
  assert.equal(new NAN(0xfe04n, null, NAN_SIZE.F64).size, NAN_SIZE.F64);
  assert.equal(
    new NAN(0xfff8100000000000n, null, NAN_SIZE.NATURAL).size,
    NAN_SIZE.F64
  );

  const n4 = new NAN(0x40000000, false);
  assert.equal(n4.sign, 1);
  assert.equal(n4.payload, 0x40000000);
  assert.equal(n4.quiet, false);
  assert.equal(n4.isShortestEncoding, true);
  assert.deepEqual(n4.bytes, hexToU8('fa7f800002'));
  assert.deepEqual(new NAN(-0x40000000).bytes, hexToU8('faffc00002'));
  assert.equal(Number(n4), NaN);
  assert.deepEqual(encode(n4), hexToU8('fa7f800002'));
  assert.equal(n4.toString(), "nan'!1073741824'_2");
  assert.equal(util.inspect(n4), "nan'!1073741824'_2");
  assert.equal(new NAN(0x7f800002n).payload, 0x40000000);
  assert.equal(new NAN(0x7f800002n).size, NAN_SIZE.F32);

  const n8 = new NAN(1);
  assert.equal(n8.sign, 1);
  assert.equal(n8.payload, 1);
  assert.equal(n8.quiet, true);
  assert.deepEqual(n8.bytes, hexToU8('fb7ff8000000000001'));
  assert.equal(n8.isShortestEncoding, true);
  assert.equal(Number(n8), NaN);
  assert.deepEqual(encode(n8), hexToU8('fb7ff8000000000001'));
  assert.equal(n8.toString(), "nan'1'_3");
  assert.equal(n8.raw, 0x7ff8000000000001n);
  assert.equal(decode(hexToU8('fb7ff8000000000001'), {keepNanPayloads: true}).constructor, NAN);
  assert.equal(decode(hexToU8('f97e00'), {keepNanPayloads: true}), NaN);
  assert.equal(decode(hexToU8('f97e01'), {keepNanPayloads: false}), NaN);
  assert.deepEqual(decode(hexToU8('fbfff8000000000001'), {keepNanPayloads: true}), new NAN(-1));
  assert.deepEqual(decode(hexToU8('faffc00001'), {keepNanPayloads: true}), new NAN(-0x20000000));
  assert.deepEqual(decode(hexToU8('f9fc01'), {keepNanPayloads: true}), new NAN(-0x40000000000));

  assert.equal(new NAN(0x7ff8000000000001n).payload, 1);
  assert.equal(new NAN(0x7ff8000000000001n).size, NAN_SIZE.F64);

  assert.equal(new NAN(0x40000000).toString(), "nan'1073741824'_2");
  assert.equal(new NAN(hexToU8('FB7FF0000400000000')).isShortestEncoding, false);
  assert.deepEqual(encode(new NAN(0x40000000, true, NAN_SIZE.F64)), hexToU8('fb7ff8000040000000'));
  assert.deepEqual(encode(new NAN(-0x40000000, true, NAN_SIZE.F64)), hexToU8('fbfff8000040000000'));
  assert.deepEqual(encode(new NAN(0x100000000000, false)), hexToU8('f97c04'));
  assert.deepEqual(encode(new NAN(-0x100000000000, false)), hexToU8('f9fc04'));
  assert.deepEqual(encode(new NAN(0x100000000000, false, NAN_SIZE.F64)), hexToU8('fb7ff0100000000000'));
  assert.deepEqual(encode(new NAN(-0x100000000000, false, NAN_SIZE.F64)), hexToU8('fbfff0100000000000'));

  assert.throws(() => new NAN(0, false));
  assert.throws(() => new NAN(''));
  assert.throws(() => new NAN(0x8000000000000));
  assert.throws(() => new NAN(-0x8000000000000));
  assert.throws(() => new NAN(new Uint8Array()));
  assert.throws(() => new NAN(1, true, 19));

  assert.throws(() => new NAN(1, true, NAN_SIZE.F16));
  assert.throws(() => new NAN(1, true, NAN_SIZE.F32));
  assert.throws(() => new NAN(1, true, NAN_SIZE.NATURAL));
  assert.throws(() => new NAN(0x7ff8000000000001n, null, NAN_SIZE.F16));
  assert.throws(() => new NAN(0x40000000, false, NAN_SIZE.F16));
  assert.throws(() => new NAN(9.3));
  assert.throws(() => new NAN(Infinity));
  assert.throws(() => new NAN(-Infinity));
  assert.throws(() => new NAN(NaN));
  assert.throws(() => new NAN(2 ** 53));
  assert.throws(() => new NAN(new Uint8Array([0xff, 0, 0])));
  assert.throws(() => new NAN(new Uint8Array([0xf9, 0, 0])));
  assert.throws(() => new NAN(new Uint8Array([0xff, 0, 0, 0, 0])));
  assert.throws(() => new NAN(new Uint8Array([0xfa, 0, 0, 0, 0])));
  assert.throws(() => new NAN(new Uint8Array([0xff, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.throws(() => new NAN(new Uint8Array([0xfb, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.throws(() => new NAN(0n));
  assert.throws(() => new NAN(1n));
});

test('LL', () => {
  // Tests from Laurence Lundblade

  const tests = [
    /* Double qNaN -- shortens to half */
    [0x7ff8000000000000n, '\xf9\x7e\x00'],

    /* Double sNaN with payload of rightmost bit set -- no shorter encoding */
    [0x7ff0000000000001n, '\xfb\x7f\xf0\x00\x00\x00\x00\x00\x01'],

    /* Double qNaN with 9 leftmost payload bits set -- shortens to half */
    [0x7ffffc0000000000n, '\xf9\x7f\xff'],

    /* Double sNaN with 10 rightmost payload bits set -- no shorter encoding */
    [0x7ff00000000003ffn, '\xfb\x7f\xf0\x00\x00\x00\x00\x03\xff'],

    /* Double qNaN with 22 leftmost payload bits set -- shortens to single */
    [0x7fffffffe0000000n, '\xfa\x7f\xff\xff\xff'],

    /* Double sNaN with 23rd leftmost payload bit set -- shortens to single */
    [0x7ff0000020000000n, '\xfa\x7f\x80\x00\x01'],

    /* Double sNaN with randomly chosen bit pattern -- shortens to single */
    [0x7ff43d7c40000000n, '\xfa\x7f\xa1\xeb\xe2'],

    /* Double sNaN with 23 leftmost payload bits set -- no shorter encoding */
    [0x7ff7fffff0000000n, '\xfb\x7f\xf7\xff\xff\xf0\x00\x00\x00'],

    /* Double qNaN with all bits set -- no shorter encoding */
    [0x7fffffffffffffffn, '\xfb\x7f\xff\xff\xff\xff\xff\xff\xff'],

    /* Single qNaN with payload 0x00 -- shortens to half */
    [0x7fc00000n, '\xf9\x7e\x00'],

    /* Single sNan with payload 0x01 -- no shorter encoding */
    [0x7f800001n, '\xfa\x7f\x80\x00\x01'],

    /* Single qNaN with 9 bit payload -- shortens to half */
    [0x7fffe000n, '\xf9\x7f\xff'],

    /* Single qNaN with 10 bit payload -- no shorter encoding */
    [0x7ffff000n, '\xfa\x7f\xff\xf0\x00'],

    /* Single qNaN with 9 bit payload -- shortens to half */
    [0x7fbfe000n, '\xf9\x7d\xff'],

    /* Single sNaN with 10 bit payload -- no shorter encoding */
    [0x7fbff000n, '\xfa\x7f\xbf\xf0\x00'],

    /* Double negative qNaN -- shortens to half */
    [0xFBFFF8000000000000n, '\xF9\xFE\x00'],

    /* Double negative sNaN with payload of rightmost bit set -- no shorter
       encoding */
    [0xFBFFF0000000000001n, '\xFB\xFF\xF0\x00\x00\x00\x00\x00\x01'],

    /* Double negative qNaN with 22 leftmost payload bits set -- shortens to
       single */
    [0xFBFFFFFFFFE0000000n, '\xFA\xFF\xFF\xFF\xFF'],
  ];

  for (const [raw, s] of tests) {
    const n = new NAN(raw);
    assert.deepEqual(u8toHex(n.bytes), Buffer.from(s, 'ascii').toString('hex'), raw.toString(16));
  }
});
