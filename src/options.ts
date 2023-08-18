import {KeySorter} from './sorts.js';
import {Simple} from './simple.js';

/**
 * Options for decoding.
 */
export interface DecodeStreamOptions {
  /**
   * Maximum allowed depth to parse into CBOR structures.  This limit is
   * security-relevant for untrusted inputs.  May be set to Infinity for
   * trusted inputs, but be careful!
   * @default 1024
   */
  maxDepth?: number;

  /**
   * If the input is a string, how should it be decoded into a byte stream?
   * Ignored if the input is a Uint8Array.
   * @default null
   */
  encoding?: 'base64' | 'hex' | null;
}

/**
 * These less-complex types are decoded as tokens at this level.
 */
export type DecodeValue = Simple | Symbol | Uint8Array | bigint | boolean |
  number | string | null | undefined;

export interface DS {
  toHere(begin?: number | undefined): Uint8Array;
}

/**
 * Information about a decoded CBOR data item.  3-element tuple, containing:
 * - Major type.
 * - Additional Information (int if < 23, else length as 24-27, 31 as stream).
 * - Decoded token value.
 * - Offset into the input where this item started.
 */
export type MtAiValue = [
  mt: number,
  ai: number,
  val: DecodeValue,
  offset: number,
];

export interface ParentConstructor {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new (
    mav: MtAiValue,
    left: number,
    parent: Parent | undefined,
    opts: RequiredDecodeOptions
  ): Parent;
}

export interface Tg {
  decode(options: RequiredDecodeOptions): unknown;
}

export interface Parent {
  parent: Parent | undefined;
  children: Tg | unknown[];
  left: number;
  push(child: unknown, stream: DS, offset: number): number;
  replaceLast(child: unknown, item: Parent, stream: DS): unknown;
  convert(): unknown;
  get done(): boolean;
  get isStreaming(): boolean;
}

/**
 * Decoding options.
 */
export interface DecodeOptions extends DecodeStreamOptions {
  /**
   * What type to create when a container is needed?
   * @default CBORcontainer
   */
  ParentType?: ParentConstructor;

  /**
   * Should numbers be created as boxed CBORNumber instances, which retain
   * their type information for round-tripping?
   * @default false
   */
  boxed?: boolean;

  /**
   * If there are duplicate keys in a map, should we throw an exception? Note:
   * this is more compute-intensive than expected at the moment, but that will
   * be fixed eventually.
   * @default false
   */
  rejectDuplicateKeys?: boolean;

  /**
   * If there are bigint (tag 2/3) in the incoming data, exit with an error.
   * @default false
   */
  rejectBigInts?: boolean;

  /**
   * Reject any floating point numbers.  This might be used in profiles that
   * are not expecting floats to prevent one from being coerced to an
   * integer-looking number without the receiver knowing.
   * @default false
   */
  rejectFloats?: boolean;

  /**
   * If non-null, keys being decoded MUST be in this order.  Note that this is a
   * superset of rejectDuplicateKeys, and is slightly more efficient.
   * @default null
   */
  sortKeys?: KeySorter | null;

  /**
   * If negative zero (-0) is received, throw an error.
   * @default false
   */
  rejectNegativeZero?: boolean;

  /**
   * Reject NaNs that are not encoded as 0x7e00.
   * @default false
   */
  rejectLongLoundNaN?: boolean;

  /**
   * Reject negative integers in the range [CBOR_NEGATIVE_INT_MAX ...
   * STANDARD_NEGATIVE_INT_MAX - 1].
   * @default false
   */
  reject65bitNegative?: boolean;

  /**
   * Reject numbers that could have been encoded in a smaller encoding.
   * @default false
   */
  rejectLongNumbers?: boolean;

  /**
   * Reject any attempt to decode streaming CBOR.
   * @default false
   */
  rejectStreaming?: boolean;

  /**
   * Reject simple values other than true, false, undefined, and null.
   * @default false
   */
  rejectSimple?: boolean;

  /**
   * Reject the `undefined` simple value.  Usually used with rejectSimple.
   * @default false
   */
  rejectUndefined?: boolean;
}

export type RequiredDecodeOptions = Required<DecodeOptions>;

export interface WriterOptions {
  chunkSize?: number;
}

export type RequiredWriterOptions = Required<WriterOptions>;

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

  /**
   * Check that Maps do not contain keys that encode to the same bytes as
   * one another.
   * @default false
   */
  checkDuplicateKeys?: boolean;

  /**
   * Do not encode bigints that cannot be reduced to integers.
   * @default false
   */
  avoidBigInts?: boolean;

  /**
   * Do not encode floating point numbers that cannot be reduced to integers.
   * @default false
   */
  avoidFloats?: boolean;

  /**
   * If true, error instead of encoding an instance of Simple.
   * @default false
   */
  avoidSimple?: boolean;

  /**
   * If true, encode -0 as 0.
   * @default false
   */
  avoidNegativeZero?: boolean;

  /**
   * If true, error instead of encoding `undefined`.
   * @default false
   */
  avoidUndefined?: boolean;

  /**
   * Simplify all NaNs to 0xf97e00, even if the NaN has a payload or is
   * signalling.
   * @default false
   */
  simplifyNaN?: boolean;

  /**
   * Do not encode numbers in the range  [CBOR_NEGATIVE_INT_MAX ...
   * STANDARD_NEGATIVE_INT_MAX - 1] as MT 1.
   * @default false
   */
  avoid65bitNegative?: boolean;

  /**
   * How should the key/value pairs be sorted before an object or Map
   * gets created?
   */
  sortKeys?: KeySorter | null;
}

export type RequiredEncodeOptions = Required<EncodeOptions>;
