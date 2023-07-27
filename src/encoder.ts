/* eslint-disable @typescript-eslint/no-use-before-define */

import {MT, NUMBYTES, SIMPLE, SYMS, TAG} from './constants.js';
import {Writer, type WriterOptions, WriterOptionsDefault} from './writer.js';
import {halfToUint} from './float.js';
import {hexToU8} from './utils.js';

const HALF = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.TWO;
const FLOAT = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.FOUR;
const DOUBLE = (MT.SIMPLE_FLOAT << 5) | NUMBYTES.EIGHT;
const TRUE = (MT.SIMPLE_FLOAT << 5) | SIMPLE.TRUE;
const FALSE = (MT.SIMPLE_FLOAT << 5) | SIMPLE.FALSE;
const UNDEFINED = (MT.SIMPLE_FLOAT << 5) | SIMPLE.UNDEFINED;
const NULL = (MT.SIMPLE_FLOAT << 5) | SIMPLE.NULL;
const TE = new TextEncoder();

export interface EncodeOptions extends WriterOptions {
  /**
   * How to write TypedArrays?
   * Null to use the current platform's endian-ness.
   * True to always use little-endian.
   * False to always use big-endian.
   * @default null
   */
  forceEndian?: boolean | null;

  /**
   * Should bigints that can fit into normal integers be collapsed into
   * normal integers?
   * @default true
   */
  collapseBigInts?: boolean;
}

export type RequiredEncodeOptions = Required<EncodeOptions>;

export const EncodeOptionsDefault: RequiredEncodeOptions = {
  ...WriterOptionsDefault,
  forceEndian: null,
  collapseBigInts: true,
};

export type AbstractClassType = abstract new (...args: any) => any;
export type TypeEncoder = (
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
) => DoneEncoding | [number, unknown];

// Only add ones here that have to be in for compliance.
const TYPES = new Map<InstanceType<AbstractClassType>, TypeEncoder>([
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
export function registerEncoder(
  typ: AbstractClassType,
  encoder: TypeEncoder
): TypeEncoder | undefined {
  const old = TYPES.get(typ);
  TYPES.set(typ, encoder);
  return old;
}

/**
 * Remove the given type from being converted to CBOR.
 *
 * @param typ Type constructor, e.e.g "Array".
 * @returns Previous converter for that type, or unknown.
 */
export function clearEncoder(
  typ: AbstractClassType
): TypeEncoder | undefined {
  const old = TYPES.get(typ);
  TYPES.delete(typ);
  return old;
}

export type DoneEncoding = typeof SYMS.DONE;

export interface ToCBOR {
  /**
   * If an object implements this interface, this method will be used to
   * serialize the object when encoding.
   *
   * @param w Writer.
   * @param opts Options.
   */
  toCBOR(w: Writer, opts: RequiredEncodeOptions):
    DoneEncoding | [number, unknown];
}

export interface ToJSON {
  /**
   * Used by the JSON.stringify method to enable the transformation of an
   * object's data for JavaScript Object Notation (JSON) serialization.
   */
  toJSON(key?: any): string;
}

/**
 * Write a floating point number to the stream.  Prefers the smallest size
 * that does not lose precision for the given number.  Writes the size with
 * majpr type SIMPLE_FLOAT before big-endian bytes.
 *
 * @param val Floating point number.
 * @param w Writer.
 */
export function writeFloat(val: number, w: Writer): void {
  if (isNaN(val) || (Math.fround(val) === val)) {
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
 * the given mt a the major type.
 *
 * @param val Number that is an integer that satisfies
 *   `MIN_SAFE_INTEGER <= val <= MAX_SAFE_INTEGER`.
 * @param w Writer.
 * @param mt Major type, if desired.  Obj will be real integer > 0.
 * @throws On invalid combinations.
 */
export function writeInt(val: number, w: Writer, mt?: number): void {
  const neg = val < 0;
  const pos = neg ? -val - 1 : val;
  if (neg && mt) {
    throw new TypeError('Negative size');
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

function writeBigInt(
  val: bigint,
  w: Writer,
  opts: RequiredEncodeOptions
): void {
  const neg = val < 0n;
  const pos = neg ? -val - 1n : val;

  if (opts.collapseBigInts) {
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

  const tag = neg ? TAG.NEG_BIGINT : TAG.POS_BIGINT;
  const s = pos.toString(16);
  const z = (s.length % 2) ? '0' : '';

  writeTag(tag, w);
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
 */
export function writeNumber(val: number, w: Writer): void {
  if (!isFinite(val) ||
      (Math.round(val) !== val) ||
      (Object.is(val, -0)) ||
      // Is this a number that *looks* like an integer, but it's a float
      // whose precision is greater than 1?
      (val > Number.MAX_SAFE_INTEGER) ||
      (val < Number.MIN_SAFE_INTEGER)) {
    writeFloat(val, w);
  } else {
    writeInt(val, w);
  }
}

/**
 * Write a tag number to the output stream.  MUST be followed by writing
 * the tag contents.
 *
 * @param tag Tag number.
 * @param w Stream to write to.
 */
export function writeTag(tag: number, w: Writer): void {
  writeInt(tag, w, MT.TAG);
}

/**
 * Convert the string to UTF8.  Write the length of the UTF8 version to the
 * stream with major type UTF8_STRING, then the UTF8 bytes.
 *
 * @param val String.
 * @param w Writer.
 */
export function writeString(val: string, w: Writer): void {
  const utf8 = TE.encode(val);
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
 * @returns DONE.
 */
export function writeArray(
  obj: unknown,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding {
  const a = obj as any[];
  writeInt(a.length, w, MT.ARRAY);
  for (const i of a) { // Iterator gives undefined for holes.
    writeUnknown(i, w, opts);
  }
  return SYMS.DONE;
}

/**
 * Write the length of a buffer with BYTE_STRING major type, then the contents
 * of the buffer.
 *
 * @param obj Buffer.
 * @param w Writer.
 * @returns DONE.
 */
export function writeUint8Array(obj: unknown, w: Writer): DoneEncoding {
  const u = obj as Uint8Array;
  writeInt(u.length, w, MT.BYTE_STRING);
  w.write(u);
  return SYMS.DONE;
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

  const encoder = TYPES.get(obj.constructor);
  if (encoder) {
    const res = encoder(obj, w, opts);
    if (res !== SYMS.DONE) {
      if (typeof res[0] === 'number') {
        writeTag(res[0], w);
      }
      writeUnknown(res[1], w, opts);
    }
    return;
  }

  if (typeof (obj as ToCBOR).toCBOR === 'function') {
    const res = (obj as ToCBOR).toCBOR(w, opts);
    if (res !== SYMS.DONE) {
      writeTag(res[0], w);
      writeUnknown(res[1], w, opts);
    }
    return;
  }

  if (typeof (obj as ToJSON).toJSON === 'function') {
    writeUnknown((obj as ToJSON).toJSON(), w, opts);
    return;
  }

  const entries = Object.entries(obj);
  writeInt(entries.length, w, MT.MAP);

  for (const [k, v] of entries) {
    writeString(k, w);
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
    case 'number': writeNumber(val, w); break;
    case 'bigint': writeBigInt(val, w, opts); break;
    case 'string': writeString(val, w); break;
    case 'boolean': w.writeUint8(val ? TRUE : FALSE); break;
    case 'undefined': w.writeUint8(UNDEFINED); break;
    case 'object': writeObject(val, w, opts); break;
    case 'symbol':
      // TODO: Add pluggable support for symbols
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
export function encode(val: unknown, options?: EncodeOptions): Uint8Array {
  const opts: RequiredEncodeOptions = {
    ...EncodeOptionsDefault,
    ...options,
  };
  const w = new Writer(opts);
  writeUnknown(val, w, opts);
  return w.read();
}
