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
import type {
  RequiredCommentOptions,
  RequiredDecodeOptions,
  RequiredEncodeOptions,
} from './options.js';
import {Tag, type TagDecoder} from './tag.js';
import {type TaggedValue, Writer} from './writer.js';
import {type ValueOf, box, getEncoded} from './box.js';
import {base64ToBytes, base64UrlToBytes, isBigEndian, u8toHex} from './utils.js';
import {
  encode,
  registerEncoder,
  writeInt,
  writeLength,
  writeTag,
  writeUnknown,
} from './encoder.js';
import {KeyValueEncoded} from './sorts.js';
import {comment} from './comment.js';

const LE = !isBigEndian();

function assertNumber(contents: unknown): asserts contents is number {
  if ((typeof contents === 'object') && contents) {
    if (contents.constructor !== Number) {
      throw new Error(`Expected number: ${contents}`);
    }
  } else if (typeof contents !== 'number') {
    throw new Error(`Expected number: ${contents}`);
  }
}

function assertString(contents: unknown): asserts contents is string {
  if ((typeof contents === 'object') && contents) {
    if (contents.constructor !== String) {
      throw new Error(`Expected string: ${contents}`);
    }
  } else if (typeof contents !== 'string') {
    throw new Error(`Expected string: ${contents}`);
  }
}

function assertU8(contents: unknown): asserts contents is Uint8Array {
  if (!(contents instanceof Uint8Array)) {
    throw new Error(`Expected Uint8Array: ${contents}`);
  }
}

function assertArray(contents: unknown): asserts contents is unknown[] {
  if (!Array.isArray(contents)) {
    throw new Error(`Expected Array: ${contents}`);
  }
}

registerEncoder(Map, (
  obj: Map<unknown, unknown>,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => {
  const kve = [...obj.entries()].map<KeyValueEncoded>(
    e => [e[0], e[1], encode(e[0], opts)]
  );
  if (opts.rejectDuplicateKeys) {
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
  writeLength(obj, obj.size, MT.MAP, w, opts);
  for (const [_k, v, e] of kve) {
    w.write(e);
    writeUnknown(v, w, opts);
  }
});

function dateString(tag: Tag): Date {
  assertString(tag.contents);
  return new Date(tag.contents);
}
dateString.comment = (tag: Tag): string => {
  assertString(tag.contents);
  const decoded = new Date(tag.contents);
  return `(String Date) ${decoded.toISOString()}`;
};
Tag.registerDecoder(TAG.DATE_STRING, dateString);

function dateEpoch(tag: Tag): Date {
  assertNumber(tag.contents);
  return new Date(tag.contents * 1000);
}
dateEpoch.comment = (tag: Tag): string => {
  assertNumber(tag.contents);
  const decoded = new Date(tag.contents * 1000);
  return `(Epoch Date) ${(decoded as Date).toISOString()}`;
};
Tag.registerDecoder(TAG.DATE_EPOCH, dateEpoch);

registerEncoder(Date,
  (obj: Date) => [TAG.DATE_EPOCH, obj.valueOf() / 1000]);

function u8toBigInt(
  neg: boolean,
  tag: Tag,
  opts: RequiredDecodeOptions
): BigInt | bigint {
  assertU8(tag.contents);
  if (opts.rejectBigInts) {
    throw new Error(`Decoding unwanted big integer: ${tag}(h'${u8toHex(tag.contents)}')`);
  }
  if (opts.requirePreferred && tag.contents[0] === 0) {
    // The preferred serialization of the byte string is to leave out any
    // leading zeroes
    throw new Error(`Decoding overly-large bigint: ${tag.tag}(h'${u8toHex(tag.contents)})`);
  }
  let bi = tag.contents.reduce((t, v) => (t << 8n) | BigInt(v), 0n);
  if (neg) {
    bi = -1n - bi;
  }
  if (opts.requirePreferred &&
    (bi >= Number.MIN_SAFE_INTEGER) &&
    (bi <= Number.MAX_SAFE_INTEGER)) {
    // The preferred serialization of an integer that can be represented using
    // major type 0 or 1 is to encode it this way instead of as a bignum
    throw new Error(`Decoding bigint that could have been int: ${bi}n`);
  }
  if (opts.boxed) {
    return box(bi, tag.contents) as BigInt;
  }
  return bi;
}
const u8toBigIntPos: TagDecoder = u8toBigInt.bind(null, false);
const u8toBigIntNeg: TagDecoder = u8toBigInt.bind(null, true);
u8toBigIntPos.comment = (tag: Tag, opts: RequiredCommentOptions): string => {
  const bi = u8toBigInt(false, tag, opts);
  return `(Positive BigInt) ${bi}n`;
};
u8toBigIntNeg.comment = (tag: Tag, opts: RequiredCommentOptions): string => {
  const bi = u8toBigInt(true, tag, opts);
  return `(Negative BigInt) ${bi}n`;
};

Tag.registerDecoder(TAG.POS_BIGINT, u8toBigIntPos);
Tag.registerDecoder(TAG.NEG_BIGINT, u8toBigIntNeg);

// 24: Encoded CBOR data item; see Section 3.4.5.1
// To turn on decoding of the embedded CBOR, do this:
// cbor.Tag.registerDecoder(24, (tag, opts) => decode(tag.contents, opts));
function embeddedCBOR(tag: Tag, _opts: RequiredDecodeOptions): unknown {
  assertU8(tag.contents);
  return tag;
}
embeddedCBOR.comment = (
  tag: Tag,
  opts: RequiredCommentOptions,
  depth: number
): string => {
  assertU8(tag.contents);

  // There is lots of manual re-work here, but I *think* this is the only
  // place that will need it.
  // Approach: Strip off the tag number from the original encoding of the
  // tag, grab the original encoding of the byte string length, use that
  // original encoding to write the still-needed Bytes line,
  // then CBOR-decode (and comment) the embedded buffer.
  // Ensure noChildren is set, since this will replace the normal child
  // string.
  const embeddedOpts: RequiredCommentOptions = {
    ...opts,
    initialDepth: depth + 2,
    noPrefixHex: true,
  };

  // Original encoding of Tag+24 might be 2,3,5, or 9 bytes.
  const orig = getEncoded(tag) as Uint8Array;
  const tagAI = orig[0] & 0x1f;
  let offset = (2 ** (tagAI - 24)) + 1;
  const contentsAI = orig[offset] & 0x1f;
  let malStr = u8toHex(orig.subarray(offset, ++offset));
  if (contentsAI >= 24) {
    malStr += ' ';
    malStr += u8toHex(orig.subarray(
      offset,
      offset + (2 ** (contentsAI - 24))
    ));
  }

  embeddedOpts.minCol = Math.max(
    embeddedOpts.minCol,
    ((depth + 1) * 2) + malStr.length
  );

  // Before, so minDepth gets set.
  const c = comment(tag.contents, embeddedOpts);
  let ret = 'Embedded CBOR\n';
  ret += `${''.padStart((depth + 1) * 2, ' ')}${malStr}`.padEnd(embeddedOpts.minCol + 1, ' ');
  ret += `-- Bytes (Length: ${tag.contents.length})\n`;

  ret += c;
  return ret;
};
embeddedCBOR.noChildren = true;
Tag.registerDecoder(TAG.CBOR, embeddedCBOR);

Tag.registerDecoder(TAG.URI, (tag: Tag): URL => {
  assertString(tag.contents);
  return new URL(tag.contents);
}, 'URI');

registerEncoder(URL, (obj: URL) => [TAG.URI, obj.toString()]);

Tag.registerDecoder(TAG.BASE64URL, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64UrlToBytes(tag.contents);
}, 'Base64url-encoded');

Tag.registerDecoder(TAG.BASE64, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64ToBytes(tag.contents);
}, 'Base64-encoded');

// Old/deprecated regexp tag
Tag.registerDecoder(35, (tag: Tag): RegExp => {
  assertString(tag.contents);
  return new RegExp(tag.contents);
}, 'RegExp');

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
}, 'I-RegExp');

Tag.registerDecoder(TAG.REGEXP, (tag: Tag): RegExp => {
  assertArray(tag.contents);
  if (tag.contents.length < 1 || tag.contents.length > 2) {
    throw new Error(`Invalid RegExp Array: ${tag.contents}`);
  }
  return new RegExp(tag.contents[0] as string, tag.contents[1] as string);
}, 'RegExp');

registerEncoder(RegExp, (obj: RegExp) => [TAG.REGEXP, [obj.source, obj.flags]]);

// 64:uint8 Typed Array
Tag.registerDecoder(64, (tag: Tag): Uint8Array => {
  assertU8(tag.contents);
  return tag.contents;
}, 'uint8 Typed Array');

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
  S extends TypedArray
>(tag: Tag, Typ: TypedArrayConstructor<S>, littleEndian: boolean): S {
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

// eslint-disable-next-line @typescript-eslint/max-params
function writeTyped(
  w: Writer,
  littleTag: number,
  bigTag: number,
  array: TypedArray,
  opts: RequiredEncodeOptions
): undefined {
  const endian = opts.forceEndian ?? LE;
  const tag = endian ? littleTag : bigTag;
  writeTag(tag, w, opts);
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
}

// 65: uint16, big endian, Typed Array
Tag.registerDecoder(65,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, false),
  'uint16, big endian, Typed Array');

// 66: uint32, big endian, Typed Array
Tag.registerDecoder(66,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, false),
  'uint32, big endian, Typed Array');

// 67: uint64, big endian, Typed Array
Tag.registerDecoder(67,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, false),
  'uint64, big endian, Typed Array');

// 68: uint8 Typed Array, clamped arithmetic
Tag.registerDecoder(68, (tag: Tag): Uint8ClampedArray => {
  assertU8(tag.contents);
  return new Uint8ClampedArray(tag.contents);
}, 'uint8 Typed Array, clamped arithmetic');

registerEncoder(Uint8ClampedArray, (u: Uint8ClampedArray) => [
  68,
  new Uint8Array(u.buffer, u.byteOffset, u.byteLength),
]);

// 69: uint16, little endian, Typed Array
Tag.registerDecoder(69,
  (tag: Tag): Uint16Array => convertToTyped(tag, Uint16Array, true),
  'uint16, little endian, Typed Array');

registerEncoder(Uint16Array, (
  obj: Uint16Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 69, 65, obj, opts));

// 70: uint32, little endian, Typed Array
Tag.registerDecoder(70,
  (tag: Tag): Uint32Array => convertToTyped(tag, Uint32Array, true),
  'uint32, little endian, Typed Array');
registerEncoder(Uint32Array, (
  obj: Uint32Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 70, 66, obj, opts));

// 71: uint64, little endian, Typed Array
Tag.registerDecoder(71,
  (tag: Tag): BigUint64Array => convertToTyped(tag, BigUint64Array, true),
  'uint64, little endian, Typed Array');
registerEncoder(BigUint64Array, (
  obj: BigUint64Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 71, 67, obj, opts));

// 72: sint8 Typed Array
Tag.registerDecoder(72, (tag: Tag): Int8Array => {
  assertU8(tag.contents);
  return new Int8Array(tag.contents); // Wraps
}, 'sint8 Typed Array');
registerEncoder(Int8Array, (u: Int8Array) => [
  72,
  new Uint8Array(u.buffer, u.byteOffset, u.byteLength),
]);

// 73: sint16, big endian, Typed Array
Tag.registerDecoder(73,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, false),
  'sint16, big endian, Typed Array');

// 74: sint32, big endian, Typed Array
Tag.registerDecoder(74,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, false),
  'sint32, big endian, Typed Array');

// 75: sint64, big endian, Typed Array
Tag.registerDecoder(75,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, false),
  'sint64, big endian, Typed Array');

// 76: Reserved
// 77: sint16, little endian, Typed Array
Tag.registerDecoder(77,
  (tag: Tag): Int16Array => convertToTyped(tag, Int16Array, true),
  'sint16, little endian, Typed Array');
registerEncoder(Int16Array, (
  obj: Int16Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 77, 73, obj, opts));

// 78: sint32, little endian, Typed Array
Tag.registerDecoder(78,
  (tag: Tag): Int32Array => convertToTyped(tag, Int32Array, true),
  'sint32, little endian, Typed Array');
registerEncoder(Int32Array, (
  obj: Int32Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 78, 74, obj, opts));

// 79: sint64, little endian, Typed Array
Tag.registerDecoder(79,
  (tag: Tag): BigInt64Array => convertToTyped(tag, BigInt64Array, true),
  'sint64, little endian, Typed Array');
registerEncoder(BigInt64Array, (
  obj: BigInt64Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 79, 75, obj, opts));

// 80: IEEE 754 binary16, big endian, Typed Array.  Not implemented.
// 81: IEEE 754 binary32, big endian, Typed Array
Tag.registerDecoder(81,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, false),
  'IEEE 754 binary32, big endian, Typed Array');

// 82: IEEE 754 binary64, big endian, Typed Array
Tag.registerDecoder(82,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, false),
  'IEEE 754 binary64, big endian, Typed Array');

// 83: IEEE 754 binary128, big endian, Typed Array.  Not implemented.
// 84: IEEE 754 binary16, little endian, Typed Array.  Not implemented.

// 85: IEEE 754 binary32, little endian, Typed Array
Tag.registerDecoder(85,
  (tag: Tag): Float32Array => convertToTyped(tag, Float32Array, true),
  'IEEE 754 binary32, little endian, Typed Array');
registerEncoder(Float32Array, (
  obj: Float32Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 85, 81, obj, opts));

// 86: IEEE 754 binary64, big endian, Typed Array
Tag.registerDecoder(86,
  (tag: Tag): Float64Array => convertToTyped(tag, Float64Array, true),
  'IEEE 754 binary64, big endian, Typed Array');
registerEncoder(Float64Array, (
  obj: Float64Array,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined => writeTyped(w, 86, 82, obj, opts));

Tag.registerDecoder(TAG.SET, (tag: Tag) => {
  assertArray(tag.contents);
  return new Set(tag.contents);
}, 'Set');

registerEncoder(Set, (obj: Set<unknown>) => [TAG.SET, [...obj]]);

Tag.registerDecoder(TAG.JSON, (tag: Tag) => {
  assertString(tag.contents);
  return JSON.parse(tag.contents);
}, 'JSON-encoded');

Tag.registerDecoder(TAG.SELF_DESCRIBED,
  (tag: Tag): unknown => tag.contents,
  'Self-Described');

Tag.registerDecoder(TAG.INVALID_16, () => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_16}`);
}, 'Invalid');

Tag.registerDecoder(TAG.INVALID_32, () => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_32}`);
}, 'Invalid');

Tag.registerDecoder(TAG.INVALID_64, () => {
  throw new Error(`Tag always invalid: ${TAG.INVALID_64}`);
}, 'Invalid');

function intentionallyUnimplemented(obj: unknown): undefined {
  throw new Error(`Encoding ${(obj as object).constructor.name} intentionally unimplmented.  It is not concrete enough to interoperate.  Convert to Uint8Array first.`);
}
registerEncoder(ArrayBuffer, intentionallyUnimplemented);
registerEncoder(DataView, intentionallyUnimplemented);

if (typeof SharedArrayBuffer !== 'undefined') {
  registerEncoder(SharedArrayBuffer, intentionallyUnimplemented);
}

// I don't understand this lint error adequately.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function writeBoxed<T>(
  obj: unknown
): TaggedValue {
  return [NaN, (obj as ValueOf<T>).valueOf()];
}

// These mostly-useless types get converted to their unboxed values.
// They will never have ENCODED stored on them at this point.
registerEncoder(Boolean, writeBoxed<Boolean>);
registerEncoder(Number, writeBoxed<Number>);
registerEncoder(String, writeBoxed<String>);

// @ts-expect-error Boxed BigInt doesn't have a real constructor.  This isn't
// worth making the types even more opaque to fix.
registerEncoder(BigInt, writeBoxed);
