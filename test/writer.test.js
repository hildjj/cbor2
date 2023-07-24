import {Writer} from '../lib/writer.js';
import assert from 'node:assert/strict';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';

test('writer', () => {
  const w = new Writer();
  assert(w);
  assert.throws(() => new Writer({chunk_size: 2}));
  assert.equal(w.length, 0);
  assert.deepEqual(w.read(), new Uint8Array([]));

  w.write(hexToU8('000102'));
  assert.deepEqual(w.read(), new Uint8Array([0, 1, 2]));
});

test('small chunk writer', () => {
  const w = new Writer({chunk_size: 8});
  assert(w);
  w.write(new Uint8Array(16)); // Overflow chunk
  assert.deepEqual(w.read(), new Uint8Array(16));
  w.write(new Uint8Array(4)); // Still 4 left
  w.write(new Uint8Array(6)); // Trim and alloc
  w.writeBigUint64(0n); // Trim and alloc w/ #makeSpace
  assert.deepEqual(w.read(), new Uint8Array(34));
});

test('TypedArray writes', () => {
  const w = new Writer();
  assert(w);
  w.writeBigUint64(8n);
  assert.equal(w.length, 8);
  assert.deepEqual(w.read(), new Uint8Array([0, 0, 0, 0, 0, 0, 0, 8]));
  w.clear();
  assert.equal(w.length, 0);

  w.writeUint8(2);
  assert.deepEqual(w.read(), new Uint8Array([2]));
  w.clear();

  w.writeUint16(2);
  assert.deepEqual(w.read(), new Uint8Array([0, 2]));
  w.clear();

  w.writeUint32(2);
  assert.deepEqual(w.read(), new Uint8Array([0, 0, 0, 2]));
  w.clear();

  w.writeFloat32(2.5);
  assert.deepEqual(w.read(), new Uint8Array([64, 32, 0, 0]));
  w.clear();

  w.writeFloat64(2.5);
  assert.deepEqual(w.read(), new Uint8Array([64, 4, 0, 0, 0, 0, 0, 0]));
  w.clear();
});
