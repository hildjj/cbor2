import {Tag} from './tag.js';
import {base64ToBytes} from './utils.js';
import {decode} from './decoder.js';

function assertNumber(contents: any): asserts contents is number {
  if (typeof contents !== 'number') {
    throw new Error('Expected number');
  }
}

function assertString(contents: any): asserts contents is string {
  if (typeof contents !== 'string') {
    throw new Error('Expected string');
  }
}

function assertU8(contents: any): asserts contents is Uint8Array {
  if (!(contents instanceof Uint8Array)) {
    throw new Error('Expected Uint8Array');
  }
}

Tag.registerType(0, tag => {
  assertString(tag.contents);
  return new Date(tag.contents);
});

Tag.registerType(1, tag => {
  assertNumber(tag.contents);
  return new Date(tag.contents * 1000);
});

function u8toBigInt(tag: Tag): bigint {
  assertU8(tag.contents);
  return tag.contents.reduce((t, v) => (t << 8n) | BigInt(v), 0n);
}
Tag.registerType(2, u8toBigInt);
Tag.registerType(3, (tag: Tag): bigint => -1n - u8toBigInt(tag));

// 24: Encoded CBOR data item; see Section 3.4.5.1
Tag.registerType(24, (tag: Tag): any => {
  assertU8(tag.contents);
  return decode(tag.contents);
});

Tag.registerType(32, (tag: Tag): URL => {
  assertString(tag.contents);
  return new URL(tag.contents);
});

Tag.registerType(34, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64ToBytes(tag.contents);
});

Tag.registerType(35, (tag: Tag): RegExp => {
  assertString(tag.contents);
  return new RegExp(tag.contents);
});

// 64:uint8 Typed Array
Tag.registerType(64, (tag: Tag): Uint8Array => {
  assertU8(tag.contents);
  return tag.contents;
});

// For the typed arrays, can't convert directly to the TypedArray if we are in
// the correct endian-ness, because the source is unlikely to be aligned
// correctly.

interface TypedArray {
  [n: number]: bigint | number;
}

interface TypedArrayConstructor<T> {
  readonly BYTES_PER_ELEMENT: number;
  new(length: number): T;
}

function convertToTyped<
  S extends TypedArray,
  T extends TypedArrayConstructor<S>
>(tag: Tag, Typ: T, littleEndian: boolean): S {
  assertU8(tag.contents);
  let len = tag.contents.length;
  if ((len % Typ.BYTES_PER_ELEMENT) !== 0) {
    throw new Error(`Number of bytes must be divisible by ${Typ.BYTES_PER_ELEMENT}, got: ${len}`);
  }
  len /= Typ.BYTES_PER_ELEMENT;
  const ret = new Typ(len);
  const dv = new DataView(
    tag.contents.buffer,
    tag.contents.byteOffset,
    tag.contents.byteLength
  );
  // @ts-expect-error Ignore this fanciness.
  const getter = dv[`get${Typ.name.replace(/Array/, '')}`].bind(dv);
  for (let i = 0; i < len; i++) {
    ret[i] = getter(i * Typ.BYTES_PER_ELEMENT, littleEndian);
  }
  return ret;
}

// 65: uint16, big endian, Typed Array
Tag.registerType(65,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, false));

// 66: uint32, big endian, Typed Array
Tag.registerType(66,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, false));

// 67: uint64, big endian, Typed Array
Tag.registerType(67,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, false));

// 68: uint8 Typed Array, clamped arithmetic
Tag.registerType(68, (tag: Tag): Uint8ClampedArray => {
  assertU8(tag.contents);
  return new Uint8ClampedArray(tag.contents);
});

// 69: uint16, little endian, Typed Array
Tag.registerType(69,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, true));

// 70: uint32, little endian, Typed Array
Tag.registerType(70,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, true));

// 71: uint64, little endian, Typed Array
Tag.registerType(71,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, true));

// 72: sint8 Typed Array
Tag.registerType(72, (tag: Tag): Int8Array => {
  assertU8(tag.contents);
  return new Int8Array(tag.contents); // Wraps
});

// 73: sint16, big endian, Typed Array
Tag.registerType(73,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, false));

// 74: sint32, big endian, Typed Array
Tag.registerType(74,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, false));

// 75: sint64, big endian, Typed Array
Tag.registerType(75,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, false));

// 76: Reserved
// 77: sint16, little endian, Typed Array
Tag.registerType(77,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, true));

// 78: sint32, little endian, Typed Array
Tag.registerType(78,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, true));

// 79: sint64, little endian, Typed Array
Tag.registerType(79,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, true));

// 80: IEEE 754 binary16, big endian, Typed Array.  Not implemented.
// 81: IEEE 754 binary32, big endian, Typed Array
Tag.registerType(81,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, false));

// 82: IEEE 754 binary64, big endian, Typed Array
Tag.registerType(82,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, false));

// 83: IEEE 754 binary128, big endian, Typed Array.  Not implemented.
// 84: IEEE 754 binary16, little endian, Typed Array.  Not implemented.

// 85: IEEE 754 binary32, little endian, Typed Array
Tag.registerType(85,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, true));

// 86: IEEE 754 binary64, big endian, Typed Array
Tag.registerType(86,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, true));

Tag.registerType(55799, (tag: Tag): any => tag.contents);
