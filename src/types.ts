/**
 * Register all of the implemented tag types for both encoding and ecoding.
 * Import this file for side effects only.
 *
 * After this is imported, you may want to tweak the encoding/decoding of
 * certain classes with `Tag.registerType` and `encoder.addType`.
 *
 * Note that type registrations are currently GLOBAL in scope for simplicity.
 *
 * @module
 */

import {MT, TAG} from './constants.js';
import {
  type RequiredEncodeOptions,
  addType,
  writeArray,
  writeInt,
  writeNumber,
  writeString,
  writeTag,
  writeUint8Array,
  writeUnknown,
} from './encoder.js';
import {base64ToBytes, base64UrlToBytes, isBigEndian} from './utils.js';
import {Tag} from './tag.js';
import type {Writer} from './writer.js';
import {decode} from './decoder.js';

const LE = !isBigEndian();

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

function assertArray(contents: any): asserts contents is any[] {
  if (!Array.isArray(contents)) {
    throw new Error('Expected Array');
  }
}

addType(Map, (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
  const m = obj as Map<unknown, unknown>;
  writeInt(w, m.size, MT.MAP);
  for (const [k, v] of m) {
    writeUnknown(w, k, opts);
    writeUnknown(w, v, opts);
  }
});

Tag.registerType(TAG.DATE_STRING, tag => {
  assertString(tag.contents);
  return new Date(tag.contents);
});

Tag.registerType(TAG.DATE_EPOCH, tag => {
  assertNumber(tag.contents);
  return new Date(tag.contents * 1000);
});

addType(Date, (w: Writer, obj: unknown) => {
  const d = obj as Date;
  writeTag(w, TAG.DATE_EPOCH); // TODO: Make configurable?
  writeNumber(w, d.valueOf() / 1000);
});

function u8toBigInt(tag: Tag): bigint {
  assertU8(tag.contents);
  return tag.contents.reduce((t, v) => (t << 8n) | BigInt(v), 0n);
}
Tag.registerType(TAG.POS_BIGINT, u8toBigInt);
Tag.registerType(TAG.NEG_BIGINT, (tag: Tag): bigint => -1n - u8toBigInt(tag));

// 24: Encoded CBOR data item; see Section 3.4.5.1
Tag.registerType(TAG.CBOR, (tag: Tag): any => {
  assertU8(tag.contents);
  return decode(tag.contents);
});

Tag.registerType(TAG.URI, (tag: Tag): URL => {
  assertString(tag.contents);
  return new URL(tag.contents);
});

addType(URL, (w: Writer, obj: unknown) => {
  const u = obj as URL;
  writeTag(w, TAG.URI);
  writeString(w, u.toString());
});

Tag.registerType(TAG.BASE64URL, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64UrlToBytes(tag.contents);
});

Tag.registerType(TAG.BASE64, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64ToBytes(tag.contents);
});

Tag.registerType(TAG.REGEXP, (tag: Tag): RegExp => {
  assertString(tag.contents);
  return new RegExp(tag.contents);
});

addType(RegExp, (w: Writer, obj: unknown) => {
  const r = obj as RegExp;
  writeTag(w, TAG.REGEXP);
  writeString(w, r.source);
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
  buffer: ArrayBuffer;
  byteLength: number;
  byteOffset: number;
  [Symbol.iterator](): IterableIterator<bigint | number>;
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

// eslint-disable-next-line max-params
function writeTyped<T extends TypedArray>(
  w: Writer,
  littleTag: number,
  bigTag: number,
  array: T,
  opts: RequiredEncodeOptions
): void {
  const endian = opts.forceEndian ?? LE;
  const tag = endian ? littleTag : bigTag;
  writeTag(w, tag);
  writeInt(w, array.byteLength, MT.BYTE_STRING);
  if (LE === endian) {
    w.write(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  } else {
    const nm = `write${array.constructor.name.replace(/Array/, '')}`;
    // @ts-expect-error Ignore this fanciness.
    const setter = w[nm].bind(w);
    for (const i of array) {
      setter(i, endian);
    }
  }
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

addType(Uint8ClampedArray, (w: Writer, obj: unknown) => {
  const u = obj as Uint8ClampedArray;
  writeTag(w, 68);
  writeInt(w, u.length, MT.BYTE_STRING);
  w.write(new Uint8Array(u.buffer, u.byteOffset, u.byteLength));
});

// 69: uint16, little endian, Typed Array
Tag.registerType(69,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, true));
addType(
  Uint16Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 69, 65, obj as Uint16Array, opts);
  }
);

// 70: uint32, little endian, Typed Array
Tag.registerType(70,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, true));
addType(
  Uint32Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 70, 66, obj as Uint32Array, opts);
  }
);

// 71: uint64, little endian, Typed Array
Tag.registerType(71,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, true));
addType(
  BigUint64Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 71, 67, obj as BigUint64Array, opts);
  }
);

// 72: sint8 Typed Array
Tag.registerType(72, (tag: Tag): Int8Array => {
  assertU8(tag.contents);
  return new Int8Array(tag.contents); // Wraps
});
addType(Int8Array, (w: Writer, obj: unknown) => {
  const u = obj as Int8Array;
  writeTag(w, 72);
  writeInt(w, u.length, MT.BYTE_STRING);
  w.write(new Uint8Array(u.buffer, u.byteOffset, u.byteLength));
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
addType(
  Int16Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 77, 73, obj as Int16Array, opts);
  }
);

// 78: sint32, little endian, Typed Array
Tag.registerType(78,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, true));
addType(
  Int32Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 78, 74, obj as Int32Array, opts);
  }
);

// 79: sint64, little endian, Typed Array
Tag.registerType(79,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, true));
addType(
  BigInt64Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 79, 75, obj as BigInt64Array, opts);
  }
);

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
addType(
  Float32Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 85, 81, obj as Float32Array, opts);
  }
);

// 86: IEEE 754 binary64, big endian, Typed Array
Tag.registerType(86,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, true));
addType(
  Float64Array,
  (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
    writeTyped(w, 86, 82, obj as Float64Array, opts);
  }
);

Tag.registerType(TAG.SET, (tag: Tag) => {
  assertArray(tag.contents);
  return new Set(tag.contents);
});

addType(Set, (w: Writer, obj: unknown, opts: RequiredEncodeOptions) => {
  const s = obj as Set<unknown>;
  writeTag(w, TAG.SET);
  writeArray(w, [...s], opts);
});

Tag.registerType(TAG.JSON, (tag: Tag) => {
  assertString(tag.contents);
  return JSON.parse(tag.contents);
});

Tag.registerType(TAG.SELF_DESCRIBED, (tag: Tag): any => tag.contents);

Tag.registerType(TAG.INVALID_16, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_16}`);
});

Tag.registerType(TAG.INVALID_32, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_32}`);
});

Tag.registerType(TAG.INVALID_64, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_64}`);
});

function intentionallyUnimplemented(w: Writer, obj: unknown) {
  throw new Error(`Encoding ${(obj as object).constructor.name} intentionally unimplmented.  It is not concrete enough to interoperate.  Convert to Uint8Array first.`)
}
addType(ArrayBuffer, intentionallyUnimplemented);
addType(SharedArrayBuffer, intentionallyUnimplemented);
addType(DataView, intentionallyUnimplemented);

function writeBoxed(
  w: Writer,
  obj: unknown,
  opts: RequiredEncodeOptions
): void {
  const b = obj as Boolean | Number | String;
  writeUnknown(w, b.valueOf(), opts);
}

// These useless types get converted to their unboxed values.
addType(Boolean, writeBoxed);
addType(Number, writeBoxed);
addType(String, writeBoxed);
