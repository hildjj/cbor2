/* eslint-disable @typescript-eslint/no-use-before-define */

import {DCBOR_INT, MT, NUMBYTES, SIMPLE, SYMS, TAG} from './constants.js';
import type {EncodeOptions, RequiredEncodeOptions} from './options.js';
import {type KeyValueEncoded, sortCoreDeterministic} from './sorts.js';
import {type TagNumber, type TaggedValue, type ToCBOR, Writer} from './writer.js';
import {box, getEncodedLength} from './box.js';
import {flushToZero, halfToUint} from './float.js';
import {hexToU8} from './utils.js';

export const {
  ENCODED,
} = SYMS;

const HALF = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.TWO;
const FLOAT = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.FOUR;
const DOUBLE = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.EIGHT;
const TRUE = (MT.SIMPLE_FLOAT << 5) | SIMPLE.TRUE;
const FALSE = (MT.SIMPLE_FLOAT << 5) | SIMPLE.FALSE;
const UNDEFINED = (MT.SIMPLE_FLOAT << 5) | SIMPLE.UNDEFINED;
const NULL = (MT.SIMPLE_FLOAT << 5) | SIMPLE.NULL;
const TE = new TextEncoder();

export const defaultEncodeOptions: RequiredEncodeOptions = {
  ...Writer.defaultOptions,
  avoidInts: false,
  cde: false,
  collapseBigInts: true,
  dcbor: false,
  float64: false,
  flushToZero: false,
  forceEndian: null,
  ignoreOriginalEncoding: false,
  largeNegativeAsBigInt: false,
  reduceUnsafeNumbers: false,
  rejectBigInts: false,
  rejectCustomSimples: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectUndefined: false,
  simplifyNegativeZero: false,
  sortKeys: null,
  stringNormalization: null,
};

/**
 * Encode with CDE ({@link
 * https://www.ietf.org/archive/id/draft-ietf-cbor-cde-05.html CBOR Common
 * Deterministic Encoding Profile}).  Eable this set of options by setting
 * `cde` to true.
 *
 * Since cbor2 always uses preferred encoding, this option only sets the
 * sort algorithm for map/object keys, and ensures that any original
 * encoding information (from decoding with saveOriginal) is ignored.
 */
export const cdeEncodeOptions: EncodeOptions = {
  cde: true,
  ignoreOriginalEncoding: true,
  sortKeys: sortCoreDeterministic,
};

/**
 * Encode with CDE and dCBOR ({@link
 * https://www.ietf.org/archive/id/draft-mcnally-deterministic-cbor-11.html
 * dCBOR: A Deterministic CBOR Application Profile}).  Enable this set of
 * options by setting `dcbor` to true.
 *
 * Several of these options can cause errors to be thrown for inputs that
 * would have otherwise generated valid CBOR (e.g. `undefined`).
 */
export const dcborEncodeOptions: EncodeOptions = {
  ...cdeEncodeOptions,
  dcbor: true,
  largeNegativeAsBigInt: true,
  reduceUnsafeNumbers: true,
  rejectCustomSimples: true,
  rejectDuplicateKeys: true,
  rejectUndefined: true,
  simplifyNegativeZero: true,
  stringNormalization: 'NFC',
};

/**
 * Any class.  Ish.
 */
export type AbstractClassType<T extends abstract new (...args: any) => any> =
  abstract new (...args: any) => InstanceType<T>;

export type TypeEncoder<T> = (
  obj: T,
  w: Writer,
  opts: RequiredEncodeOptions
) => TaggedValue | undefined;

export interface ToJSON {
  /**
   * Used by the JSON.stringify method to enable the transformation of an
   * object's data for JavaScript Object Notation (JSON) serialization.
   */
  toJSON(key?: unknown): string;
}

function cborAbs(value: number): [num: number, neg: boolean];
function cborAbs(value: bigint): [num: bigint, neg: boolean];
function cborAbs(value: number | bigint): [num: number | bigint, neg: boolean];
function cborAbs(value: number | bigint): [num: number | bigint, neg: boolean] {
  const neg = value < 0;
  if (typeof value === 'bigint') {
    return [neg ? -value - 1n : value, neg];
  }
  return [neg ? -value - 1 : value, neg];
}

/**
 * Write a floating point number to the stream.  Prefers the smallest size
 * that does not lose precision for the given number.  Writes the size with
 * majpr type SIMPLE_FLOAT before big-endian bytes.
 *
 * @param val Floating point number.
 * @param w Writer.
 * @param opts Encoding options.
 * @throws On unwanted float.
 */
export function writeFloat(
  val: number,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  if (opts.rejectFloats) {
    throw new Error(`Attempt to encode an unwanted floating point number: ${val}`);
  }
  if (isNaN(val)) {
    // NaNs always get simplified, because ECMA-262 says that implementations
    // don't have to be careful with signalling NaNs or those with payloads,
    // and v8/SpiderMonkey make different choices.  v8 has some support,
    // but mangles 32-bit signaling NaNs.
    w.writeUint8(HALF);
    w.writeUint16(0x7e00);
  } else if (!opts.float64 && (Math.fround(val) === val)) {
    // It's at least as small as f32.
    const half = halfToUint(val);
    if (half === null) {
      w.writeUint8(FLOAT);
      w.writeFloat32(val);
    } else {
      w.writeUint8(HALF);
      w.writeUint16(half);
    }
  } else {
    w.writeUint8(DOUBLE);
    w.writeFloat64(val);
  }
}

/**
 * Write a number that is sure to be an integer to the stream.  If no mt is
 * given writes major type POS_INT or NEG_INT as appropriate.  Otherwise uses
 * the given mt a the major type, and the value must be non-negative.  Numbers
 * with fractions are silently truncated to integer.  Numbers outside the safe
 * range silently lose precision.  -0 is silently changed to 0.
 *
 * @param val Number that is an integer that satisfies `MIN_SAFE_INTEGER <=
 *   val <= MAX_SAFE_INTEGER`.
 * @param w Writer.
 * @param mt Major type, if desired.  Obj will be real integer > 0.
 * @throws On invalid combinations.
 */
export function writeInt(val: number, w: Writer, mt?: number): void {
  const [pos, neg] = cborAbs(val);
  if (neg && mt) {
    throw new TypeError(`Negative size: ${val}`);
  }

  mt ??= neg ? MT.NEG_INT : MT.POS_INT;
  mt <<= 5;

  if (pos < 24) {
    w.writeUint8(mt | pos);
  } else if (pos <= 0xff) {
    w.writeUint8(mt | NUMBYTES.ONE);
    w.writeUint8(pos);
  } else if (pos <= 0xffff) {
    w.writeUint8(mt | NUMBYTES.TWO);
    w.writeUint16(pos);
  } else if (pos <= 0xffffffff) {
    w.writeUint8(mt | NUMBYTES.FOUR);
    w.writeUint32(pos);
  } else {
    // Assert: MIN_SAFE_INTEGER <= val <= MAX_SAFE_INTEGER
    w.writeUint8(mt | NUMBYTES.EIGHT);
    w.writeBigUint64(BigInt(pos));
  }
}

/**
 * Write a tag number to the output stream.  MUST be followed by writing
 * the tag contents.
 *
 * @param tag Tag number.
 * @param w Stream to write to.
 */
export function writeTag(
  tag: TagNumber,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  if (typeof tag === 'number') {
    writeInt(tag, w, MT.TAG);
  } else if ((typeof tag === 'object') &&
    !opts.ignoreOriginalEncoding &&
    (SYMS.ENCODED in tag)) {
    w.write(tag[SYMS.ENCODED] as Uint8Array);
  } else if (tag as bigint <= Number.MAX_SAFE_INTEGER) {
    writeInt(Number(tag), w, MT.TAG);
  } else {
    w.writeUint8((MT.TAG << 5) | NUMBYTES.EIGHT);
    w.writeBigUint64(BigInt(tag as bigint));
  }
}

/**
 * Intended for internal use.
 *
 * @param val Bigint to write.
 * @param w Writer.
 * @param opts Options.
 * @throws On unwanted bigint.
 */
export function writeBigInt(
  val: bigint,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  const [pos, neg] = cborAbs(val);

  if (opts.collapseBigInts &&
      (!opts.largeNegativeAsBigInt || (val >= -0x8000000000000000n))) {
    if (pos <= 0xffffffffn) {
      // Always collapse small bigints
      writeInt(Number(val), w);
      return;
    }

    if (pos <= 0xffffffffffffffffn) {
      const mt = (neg ? MT.NEG_INT : MT.POS_INT) << 5;
      // Always collapse larger small bigints with a single write.
      w.writeUint8(mt | NUMBYTES.EIGHT);
      w.writeBigUint64(pos);
      return;
    }
  }

  if (opts.rejectBigInts) {
    throw new Error(`Attempt to encode unwanted bigint: ${val}`);
  }

  const tag = neg ? TAG.NEG_BIGINT : TAG.POS_BIGINT;
  const s = pos.toString(16);
  const z = (s.length % 2) ? '0' : '';

  writeTag(tag, w, opts);
  // This takes a couple of big allocs for large numbers, but I still haven't
  // found a better way.
  const buf = hexToU8(z + s);
  writeInt(buf.length, w, MT.BYTE_STRING);
  w.write(buf);
}

/**
 * Write a number, be it integer or floating point, to the stream, along with
 * the appropriate major type.
 *
 * @param val Number.
 * @param w Writer.
 * @param opts Encoding options.
 */
export function writeNumber(
  val: number,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  if (opts.flushToZero) {
    val = flushToZero(val);
  }

  if (Object.is(val, -0)) {
    if (opts.simplifyNegativeZero) {
      if (opts.avoidInts) {
        writeFloat(0, w, opts);
      } else {
        writeInt(0, w);
      }
    } else {
      writeFloat(val, w, opts);
    }
  } else if (!opts.avoidInts && Number.isSafeInteger(val)) {
    writeInt(val, w);
  } else if (opts.reduceUnsafeNumbers &&
    (Math.floor(val) === val) &&
    (val >= DCBOR_INT.MIN) &&
    (val <= DCBOR_INT.MAX)) {
    // This is going to be confusing in lots of situations, particularly if
    // collapseBigInts is not true.  Also, round-tripping will need special
    // attention.
    writeBigInt(BigInt(val), w, opts);
  } else {
    writeFloat(val, w, opts);
  }
}

/**
 * Convert the string to UTF8.  Write the length of the UTF8 version to the
 * stream with major type UTF8_STRING, then the UTF8 bytes.
 *
 * @param val String.
 * @param w Writer.
 */
export function writeString(
  val: string,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  const s = (opts.stringNormalization) ?
    val.normalize(opts.stringNormalization) :
    val;
  const utf8 = TE.encode(s);
  writeInt(utf8.length, w, MT.UTF8_STRING);
  w.write(utf8);
}

/**
 * Write the length of an array with ARRAY major type, then each of the items
 * in the array.  Writes undefined for holes in the array.
 *
 * @param obj Array.
 * @param w Writer.
 * @param opts Options.
 */
export function writeArray(
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): undefined {
  const a = obj as unknown[];

  writeLength(a, a.length, MT.ARRAY, w, opts);
  for (const i of a) { // Iterator gives undefined for holes.
    // Circular
    writeUnknown(i, w, opts);
  }
}

/**
 * Write the length of a buffer with BYTE_STRING major type, then the contents
 * of the buffer.
 *
 * @param obj Buffer.
 * @param w Writer.
 */
export function writeUint8Array(obj: unknown, w: Writer): undefined {
  const u = obj as Uint8Array;
  writeInt(u.length, w, MT.BYTE_STRING);
  w.write(u);
}

// Only add ones here that have to be in for compliance.
const TYPES = new Map<unknown, unknown>([
  [Array, writeArray],
  [Uint8Array, writeUint8Array],
]);

/**
 * Add a known converter for the given type to CBOR.
 *
 * @param typ Type constructor, e.g. "Array".
 * @param encoder Converter function for that type.
 * @returns Previous converter for that type, or unknown.
 */
export function registerEncoder<T extends AbstractClassType<T>>(
  typ: T,
  encoder: TypeEncoder<InstanceType<T>>
): TypeEncoder<T> | undefined {
  const old = TYPES.get(typ) as TypeEncoder<T> | undefined;
  TYPES.set(typ, encoder);
  return old;
}

/**
 * Remove the given type from being converted to CBOR.
 *
 * @param typ Type constructor, e.e.g "Array".
 * @returns Previous converter for that type, or unknown.
 */
export function clearEncoder<T extends AbstractClassType<T>>(
  typ: T
): TypeEncoder<T> | undefined {
  const old = TYPES.get(typ) as TypeEncoder<T> | undefined;
  TYPES.delete(typ);
  return old;
}

// eslint-disable-next-line @typescript-eslint/max-params
export function writeLength(
  obj: object,
  len: number,
  mt: number,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  const enc = getEncodedLength(obj);
  if (enc && !opts.ignoreOriginalEncoding) {
    w.write(enc);
  } else {
    writeInt(len, w, mt);
  }
}

function writeObject(
  obj: object | null,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  if (obj === null) {
    w.writeUint8(NULL);
    return;
  }

  if (!opts.ignoreOriginalEncoding && (SYMS.ENCODED in obj)) {
    w.write(obj[SYMS.ENCODED] as Uint8Array);
    return;
  }

  const encoder = TYPES.get(obj.constructor) as
    TypeEncoder<unknown> | undefined;
  if (encoder) {
    const res = encoder(obj, w, opts);
    if (res) {
      if ((typeof res[0] === 'bigint') || isFinite(Number(res[0]))) {
        writeTag(res[0], w, opts);
      }

      // Circular
      writeUnknown(res[1], w, opts);
    }
    return;
  }

  if (typeof (obj as ToCBOR).toCBOR === 'function') {
    const res = (obj as ToCBOR).toCBOR(w, opts);
    if (res) {
      if ((typeof res[0] === 'bigint') || isFinite(Number(res[0]))) {
        writeTag(res[0], w, opts);
      }
      // Circular
      writeUnknown(res[1], w, opts);
    }
    return;
  }

  if (typeof (obj as ToJSON).toJSON === 'function') {
    // Circular
    writeUnknown((obj as ToJSON).toJSON(), w, opts);
    return;
  }

  // Note: keys will never be duplicated here.
  const entries = Object.entries(obj).map<KeyValueEncoded>(
    // Circular
    e => [e[0], e[1], encode(e[0], opts)]
  );
  if (opts.sortKeys) {
    entries.sort(opts.sortKeys);
  }

  writeLength(obj, entries.length, MT.MAP, w, opts);
  for (const [_k, v, e] of entries) {
    w.write(e);
    // Circular
    writeUnknown(v, w, opts);
  }
}

/**
 * Write a single value of unknown type to the given writer.
 *
 * @param val The value.
 * @param w The writer.
 * @param opts Encoding options.
 * @throws TypeError for Symbols or unknown JS typeof results.
 */
export function writeUnknown(
  val: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  switch (typeof val) {
    case 'number': writeNumber(val, w, opts); break;
    case 'bigint': writeBigInt(val, w, opts); break;
    case 'string': writeString(val, w, opts); break;
    case 'boolean': w.writeUint8(val ? TRUE : FALSE); break;
    case 'undefined':
      if (opts.rejectUndefined) {
        throw new Error('Attempt to encode unwanted undefined.');
      }
      w.writeUint8(UNDEFINED);
      break;
    case 'object': writeObject(val, w, opts); break;
    case 'symbol':
      throw new TypeError(`Unknown symbol: ${val.toString()}`);
    default:
      throw new TypeError(
        `Unknown type: ${typeof val}, ${String(val)}`
      );
  }
}

/**
 * Convert the given input to a CBOR byte string.
 *
 * @param val Any JS value that is CBOR-convertible.
 * @param options Tweak the conversion process.
 * @returns Bytes in a Uint8Array buffer.
 */
export function encode(val: unknown, options: EncodeOptions = {}): Uint8Array {
  const opts: RequiredEncodeOptions = {...defaultEncodeOptions};
  if (options.dcbor) {
    Object.assign(opts, dcborEncodeOptions);
  } else if (options.cde) {
    Object.assign(opts, cdeEncodeOptions);
  }
  Object.assign(opts, options);

  const w = new Writer(opts);
  writeUnknown(val, w, opts);
  return w.read();
}

/**
 * Return a boxed number encoded in the desired (often non-optimal) format.
 * This might be used for APIs that have strict encoding requirements where
 * the normal JS number does not always create the correct encoding.
 * NOTES: -0 is always encoded as -0, without simplification, as long as the
 * selected encoding is floating point.  Otherwise, -0 causes an error.
 * You MUST NOT use the `ignoreOriginalEncoding` option when encoding these
 * numbers, or the encoding that is stored along with the boxed number will
 * be ignored.  The `cde` and `dcbor` options turn on `ignoreOriginalEncoding`
 * by default, so it must be exlicitly disabled.
 *
 * @example
 * const num = encodedNumber(2, 'i32');
 * // [Number: 2]
 * const enc = encode(num, {cde: true, ignoreOriginalEncoding: false});
 * // Uint8Array(3) [ 25, 0, 2 ]
 *
 * @param value Number to be encoded later
 * @param encoding Desired encoding.  Default: 'f', which uses the preferred
 *   float encoding, even for integers.
 * @returns Boxed number or bigint object with hidden property set containing
 *   the desired encoding.
 */
export function encodedNumber(value: bigint | number, encoding: 'bigint'): BigInt;
export function encodedNumber(value: bigint | number, encoding: 'i' | 'i64', majorType?: number): Number | BigInt;
export function encodedNumber(value: bigint | number, encoding: 'i0' | 'i8' | 'i16' | 'i32', majorType?: number): Number;
export function encodedNumber(value: bigint | number, encoding?: 'f' | 'f16' | 'f32' | 'f64'): Number;
export function encodedNumber(
  value: bigint | number,
  encoding?: 'bigint' | 'f' | 'f16' | 'f32' | 'f64' | 'i' | 'i0' | 'i8' | 'i16' | 'i32' | 'i64',
  majorType = MT.POS_INT
): BigInt | Number {
  if (!encoding) {
    encoding = 'f';
  }
  const opts = {
    ...defaultEncodeOptions,
    collapseBigInts: false,
    chunkSize: 10,
    simplifyNegativeZero: false,
  };
  const w = new Writer(opts);
  const numValue = Number(value);

  function breakInt(max: number): [number, number];
  function breakInt(max: bigint): [number, number | bigint];
  function breakInt(max: number | bigint): [number, number | bigint] {
    if (Object.is(value, -0)) {
      throw new Error('Invalid integer: -0');
    }
    const [pos, neg] = cborAbs(value);
    if (neg && (majorType !== MT.POS_INT)) {
      throw new Error('Invalid major type combination');
    }

    const maxNumber = (typeof max === 'number') && isFinite(max);
    if (maxNumber && !Number.isSafeInteger(numValue)) {
      throw new TypeError(`Unsafe number for ${encoding}: ${value}`);
    }

    if (pos > max) {
      throw new TypeError(`Undersized encoding ${encoding} for: ${value}`);
    }

    const mt = (neg ? MT.NEG_INT : majorType) << 5;
    if (maxNumber) {
      return [mt, Number(pos)];
    }
    return [mt, pos];
  }

  switch (encoding) {
    case 'bigint':
      if (Object.is(value, -0)) {
        throw new TypeError('Invalid bigint: -0');
      }
      value = BigInt(value);
      writeBigInt(value, w, opts);
      break;
    case 'f':
      writeFloat(numValue, w, opts);
      break;
    case 'f16': {
      const half = halfToUint(numValue);
      if (half === null) {
        throw new TypeError(`Invalid f16: ${value}`);
      }
      w.writeUint8(HALF);
      w.writeUint16(half);
      break;
    }
    case 'f32':
      if (!isNaN(numValue) && (Math.fround(numValue) !== numValue)) {
        throw new TypeError(`Invalid f32: ${value}`);
      }
      w.writeUint8(FLOAT);
      w.writeFloat32(numValue);
      break;
    case 'f64':
      // `number` always fits in f64, but `bigint` might not.  Huge bigints
      // get converted to Infinity or -Infinity.
      w.writeUint8(DOUBLE);
      w.writeFloat64(numValue);
      break;
    case 'i':
      // Use preferred encoding.
      if (Object.is(value, -0)) {
        throw new Error('Invalid integer: -0');
      }

      if (Number.isSafeInteger(numValue)) {
        writeInt(numValue, w, value < 0 ? undefined : majorType);
      } else {
        const [mt, pos] = breakInt(Infinity);
        if (pos > 0xffffffffffffffffn) {
          value = BigInt(value);
          writeBigInt(value, w, opts);
        } else {
          w.writeUint8(mt | NUMBYTES.EIGHT);
          w.writeBigUint64(BigInt(pos));
        }
      }
      break;
    case 'i0': {
      const [mt, pos] = breakInt(0x17);
      w.writeUint8(mt | pos);
      break;
    }
    case 'i8': {
      const [mt, pos] = breakInt(0xff);
      w.writeUint8(mt | NUMBYTES.ONE);
      w.writeUint8(pos);
      break;
    }
    case 'i16': {
      const [mt, pos] = breakInt(0xffff);
      w.writeUint8(mt | NUMBYTES.TWO);
      w.writeUint16(pos);
      break;
    }
    case 'i32': {
      const [mt, pos] = breakInt(0xffffffff);
      w.writeUint8(mt | NUMBYTES.FOUR);
      w.writeUint32(pos);
      break;
    }
    case 'i64': {
      const [mt, pos] = breakInt(0xffffffffffffffffn);
      w.writeUint8(mt | NUMBYTES.EIGHT);
      w.writeBigUint64(BigInt(pos));
      break;
    }
    default:
      throw new TypeError(`Invalid number encoding: "${encoding}"`);
  }
  return box(value, w.read());
}
