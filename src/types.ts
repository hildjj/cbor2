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

import {
  type DoneEncoding,
  encode,
  registerEncoder,
  writeInt,
  writeTag,
  writeUnknown,
} from './encoder.js';
import {MT, SYMS, TAG} from './constants.js';
import type {RequiredDecodeOptions, RequiredEncodeOptions} from './options.js';
import {base64ToBytes, base64UrlToBytes, hexToU8, isBigEndian, u8toHex} from './utils.js';
import {KeyValueEncoded} from './sorts.js';
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

registerEncoder(Map, (obj: unknown, w: Writer, opts: RequiredEncodeOptions) => {
  const m = obj as Map<unknown, unknown>;
  const kve = [...m.entries()].map<KeyValueEncoded>(
    e => [e[0], e[1], encode(e[0], opts)]
  );
  if (opts.checkDuplicateKeys) {
    const dups = new Set<string>();
    for (const [_k, _v, e] of kve) {
      const hex = u8toHex(e);
      if (dups.has(hex)) {
        throw new Error(`Duplicate map key: 0x${hex}`);
      }
      dups.add(hex);
    }
  }
  if (opts.sortKeys) {
    kve.sort(opts.sortKeys);
  }
  writeInt(m.size, w, MT.MAP);
  for (const [_k, v, e] of kve) {
    w.write(e);
    writeUnknown(v, w, opts);
  }
  return SYMS.DONE;
});

Tag.registerDecoder(TAG.DATE_STRING, tag => {
  assertString(tag.contents);
  return new Date(tag.contents);
});

Tag.registerDecoder(TAG.DATE_EPOCH, tag => {
  assertNumber(tag.contents);
  return new Date(tag.contents * 1000);
});

registerEncoder(Date,
  (obj: unknown) => [TAG.DATE_EPOCH, (obj as Date).valueOf() / 1000]);

function u8toBigInt(
  neg: boolean,
  tag: Tag,
  opts: RequiredDecodeOptions
): bigint {
  assertU8(tag.contents);
  let bi = tag.contents.reduce((t, v) => (t << 8n) | BigInt(v), 0n);
  if (neg) {
    bi = -1n - bi;
  }
  if (opts.boxed) {
    const bio = Object(bi);
    bio[SYMS.BIGINT_LEN] = tag.contents.length;
    return bio;
  }
  return bi;
}
Tag.registerDecoder(TAG.POS_BIGINT, u8toBigInt.bind(null, false));
Tag.registerDecoder(TAG.NEG_BIGINT, u8toBigInt.bind(null, true));
// @ts-expect-error -- I know, `new BigInt` is impossible
registerEncoder(BigInt, (
  obj: BigInt,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding | unknown => {
  const val = obj.valueOf();
  if (SYMS.BIGINT_LEN in obj) {
    const neg = val < 0n;
    const pos = neg ? -val - 1n : val;

    writeTag(neg ? TAG.NEG_BIGINT : TAG.POS_BIGINT, w);
    const s = pos.toString(16).padStart(2 * (obj[SYMS.BIGINT_LEN] as number));
    const buf = hexToU8(s);
    writeInt(buf.length, w, MT.BYTE_STRING);
    w.write(buf);
    return SYMS.DONE;
  }

  return val;
});

// 24: Encoded CBOR data item; see Section 3.4.5.1
Tag.registerDecoder(TAG.CBOR, (tag: Tag): any => {
  assertU8(tag.contents);
  return decode(tag.contents);
});

Tag.registerDecoder(TAG.URI, (tag: Tag): URL => {
  assertString(tag.contents);
  return new URL(tag.contents);
});

registerEncoder(URL,
  (obj: unknown) => [TAG.URI, (obj as URL).toString()]);

Tag.registerDecoder(TAG.BASE64URL, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64UrlToBytes(tag.contents);
});

Tag.registerDecoder(TAG.BASE64, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64ToBytes(tag.contents);
});

// Old/deprecated regexp tag
Tag.registerDecoder(35, (tag: Tag): RegExp => {
  assertString(tag.contents);
  return new RegExp(tag.contents);
});

// I-Regexp
Tag.registerDecoder(21065, (tag: Tag): RegExp => {
  assertString(tag.contents);
  // Perform the following steps on an I-Regexp to obtain an ECMAScript regexp
  // [ECMA-262]:

  // For any unescaped dots (.) outside character classes (first alternative
  // of charClass production): replace dot by [^\n\r].
  // ... yeah, we're not writing a full parser for this.  We'll give it a try,
  // though.  This regexp is like 95% of what's needed.
  // See https://regex101.com/r/UtCcwh/1
  let str = tag.contents.replace(/(?<!\\)(?<!\[(?:[^\]]|\\\])*)\./g, '[^\n\r]');

  // Envelope the result in ^(?: and )$.
  str = `^(?:${str})$`;

  // The ECMAScript regexp is to be interpreted as a Unicode pattern ("u"
  // flag; see Section 21.2.2 "Pattern Semantics" of [ECMA-262]).
  return new RegExp(str, 'u');
});

Tag.registerDecoder(TAG.REGEXP, (tag: Tag): RegExp => {
  assertArray(tag.contents);
  if (tag.contents.length < 1 || tag.contents.length > 2) {
    throw new Error('Invalid RegExp Array');
  }
  return new RegExp(tag.contents[0], tag.contents[1]);
});

registerEncoder(RegExp, (obj: unknown) => {
  const r = obj as RegExp;
  return [TAG.REGEXP, [r.source, r.flags]];
});

// 64:uint8 Typed Array
Tag.registerDecoder(64, (tag: Tag): Uint8Array => {
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
): DoneEncoding {
  const endian = opts.forceEndian ?? LE;
  const tag = endian ? littleTag : bigTag;
  writeTag(tag, w);
  writeInt(array.byteLength, w, MT.BYTE_STRING);
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
  return SYMS.DONE;
}

// 65: uint16, big endian, Typed Array
Tag.registerDecoder(65,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, false));

// 66: uint32, big endian, Typed Array
Tag.registerDecoder(66,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, false));

// 67: uint64, big endian, Typed Array
Tag.registerDecoder(67,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, false));

// 68: uint8 Typed Array, clamped arithmetic
Tag.registerDecoder(68, (tag: Tag): Uint8ClampedArray => {
  assertU8(tag.contents);
  return new Uint8ClampedArray(tag.contents);
});

registerEncoder(Uint8ClampedArray, (obj: unknown) => {
  const u = obj as Uint8ClampedArray;
  return [68, new Uint8Array(u.buffer, u.byteOffset, u.byteLength)];
});

// 69: uint16, little endian, Typed Array
Tag.registerDecoder(69,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, true));

registerEncoder(Uint16Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 69, 65, obj as Uint16Array, opts));

// 70: uint32, little endian, Typed Array
Tag.registerDecoder(70,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, true));
registerEncoder(Uint32Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 70, 66, obj as Uint32Array, opts));

// 71: uint64, little endian, Typed Array
Tag.registerDecoder(71,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, true));
registerEncoder(BigUint64Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 71, 67, obj as BigUint64Array, opts));

// 72: sint8 Typed Array
Tag.registerDecoder(72, (tag: Tag): Int8Array => {
  assertU8(tag.contents);
  return new Int8Array(tag.contents); // Wraps
});
registerEncoder(Int8Array, (obj: unknown) => {
  const u = obj as Int8Array;
  return [72, new Uint8Array(u.buffer, u.byteOffset, u.byteLength)];
});

// 73: sint16, big endian, Typed Array
Tag.registerDecoder(73,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, false));

// 74: sint32, big endian, Typed Array
Tag.registerDecoder(74,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, false));

// 75: sint64, big endian, Typed Array
Tag.registerDecoder(75,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, false));

// 76: Reserved
// 77: sint16, little endian, Typed Array
Tag.registerDecoder(77,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, true));
registerEncoder(Int16Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 77, 73, obj as Int16Array, opts));

// 78: sint32, little endian, Typed Array
Tag.registerDecoder(78,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, true));
registerEncoder(Int32Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 78, 74, obj as Int32Array, opts));

// 79: sint64, little endian, Typed Array
Tag.registerDecoder(79,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, true));
registerEncoder(BigInt64Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 79, 75, obj as BigInt64Array, opts));

// 80: IEEE 754 binary16, big endian, Typed Array.  Not implemented.
// 81: IEEE 754 binary32, big endian, Typed Array
Tag.registerDecoder(81,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, false));

// 82: IEEE 754 binary64, big endian, Typed Array
Tag.registerDecoder(82,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, false));

// 83: IEEE 754 binary128, big endian, Typed Array.  Not implemented.
// 84: IEEE 754 binary16, little endian, Typed Array.  Not implemented.

// 85: IEEE 754 binary32, little endian, Typed Array
Tag.registerDecoder(85,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, true));
registerEncoder(Float32Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 85, 81, obj as Float32Array, opts));

// 86: IEEE 754 binary64, big endian, Typed Array
Tag.registerDecoder(86,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, true));
registerEncoder(Float64Array, (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding => writeTyped(w, 86, 82, obj as Float64Array, opts));

Tag.registerDecoder(TAG.SET, (tag: Tag) => {
  assertArray(tag.contents);
  return new Set(tag.contents);
});

registerEncoder(Set, (obj: unknown) => {
  const s = obj as Set<unknown>;
  return [TAG.SET, [...s]];
});

Tag.registerDecoder(TAG.JSON, (tag: Tag) => {
  assertString(tag.contents);
  return JSON.parse(tag.contents);
});

Tag.registerDecoder(TAG.SELF_DESCRIBED, (tag: Tag): any => tag.contents);

Tag.registerDecoder(TAG.INVALID_16, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_16}`);
});

Tag.registerDecoder(TAG.INVALID_32, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_32}`);
});

Tag.registerDecoder(TAG.INVALID_64, (tag: Tag) => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_64}`);
});

function intentionallyUnimplemented(obj: unknown): DoneEncoding {
  throw new Error(`Encoding ${(obj as object).constructor.name} intentionally unimplmented.  It is not concrete enough to interoperate.  Convert to Uint8Array first.`);
}
registerEncoder(ArrayBuffer, intentionallyUnimplemented);
registerEncoder(DataView, intentionallyUnimplemented);

if (typeof SharedArrayBuffer !== 'undefined') {
  registerEncoder(SharedArrayBuffer, intentionallyUnimplemented);
}

function writeBoxed(
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding {
  const b = obj as Boolean | Number | String;
  writeUnknown(b.valueOf(), w, opts);
  return SYMS.DONE;
}

// These useless types get converted to their unboxed values.
registerEncoder(Boolean, writeBoxed);
registerEncoder(Number, writeBoxed);
registerEncoder(String, writeBoxed);
