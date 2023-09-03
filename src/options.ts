import type {KeySorter} from './sorts.js';
import type {Simple} from './simple.js';

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

export interface Sliceable {
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
  len: bigint | number,
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

export interface Decodeable {
  decode(options: RequiredDecodeOptions): unknown;
}

export interface Parent {
  parent: Parent | undefined;
  children: Decodeable | unknown[];
  left: number;
  offset: number;
  push(child: unknown, stream: Sliceable, offset: number): number;
  replaceLast(child: unknown, item: Parent, stream: Sliceable): unknown;
  convert(stream: Sliceable): unknown;
  get done(): boolean;
  get isStreaming(): boolean;
}

/**
 * Decoding options.
 */
export interface DecodeOptions extends DecodeStreamOptions {
  /**
   * What type to create when a container is needed? This is used internally
   * by comment and diagnose to add separate functionality.  Internal use only.
   * @default CBORcontainer
   * @private
   */
  ParentType?: ParentConstructor;

  /**
   * Should numbers and strings be created as boxed instances, which retain
   * their original encoding for round-tripping?  If this is true,
   * saveOriginal is also set to true.  Think of this as "saveOriginal +
   * extras".  The thought is that most use cases for saveOriginal will want
   * the original encoding of an object or array, and won't care about the
   * original encoding of strings and numbers.  Turning this on also has the
   * side-effect of making all CBOR maps decode as JS Map objects, rather than
   * plain Objects.
   * @default false
   */
  boxed?: boolean;

  /**
   * Reject negative integers in the range [CBOR_NEGATIVE_INT_MAX ...
   * STANDARD_NEGATIVE_INT_MAX - 1].
   * @default false
   */
  rejectLargeNegatives?: boolean;

  /**
   * If there are bigint (tag 2/3) in the incoming data, exit with an error.
   * @default false
   */
  rejectBigInts?: boolean;

  /**
   * If there are duplicate keys in a map, should we throw an exception? Note:
   * this is more compute-intensive than expected at the moment, but that will
   * be fixed eventually.
   * @default false
   */
  rejectDuplicateKeys?: boolean;

  /**
   * Reject any floating point numbers.  This might be used in profiles that
   * are not expecting floats to prevent one from being coerced to an
   * integer-looking number without the receiver knowing.
   * @default false
   */
  rejectFloats?: boolean;

  /**
   * Reject any mt 0/1 numbers.  This might be used in profiles that expect
   * all numbers to be encoded as floating point.
   * @default false
   */
  rejectInts?: boolean;

  /**
   * Reject NaNs that are not encoded as 0x7e00.
   * @default false
   */
  rejectLongLoundNaN?: boolean;

  /**
   * Reject numbers that could have been encoded in a smaller encoding.
   * @default false
   */
  rejectLongNumbers?: boolean;

  /**
   * If negative zero (-0) is received, throw an error.
   * @default false
   */
  rejectNegativeZero?: boolean;

  /**
   * Reject simple values other than true, false, undefined, and null.
   * @default false
   */
  rejectSimple?: boolean;

  /**
   * Reject any attempt to decode streaming CBOR.
   * @default false
   */
  rejectStreaming?: boolean;

  /**
   * Reject the `undefined` simple value.  Usually used with rejectSimple.
   * @default false
   */
  rejectUndefined?: boolean;

  /**
   * Save the original bytes associated with every object as a property of
   * that object.  Use `getEncoded(obj)` to retrieve the associated bytes.
   * If you need the original encoded form of primitive items such as numbers
   * and strings, set `boxed: true` as well.
   */
  saveOriginal?: boolean;

  /**
   * If non-null, keys being decoded MUST be in this order.  Note that this is a
   * superset of rejectDuplicateKeys, and is slightly more efficient.
   * @default null
   */
  sortKeys?: KeySorter | null;
}

export type RequiredDecodeOptions = Required<DecodeOptions>;

/**
 * Comment options on top of the decode options.
 */
export interface CommentOptions extends DecodeOptions {
  /**
   * For the root object, how many levels of nesting is it already?
   * Happens with tag 24.
   * @default 0
   */
  initialDepth?: number;

  /**
   * If true, don't add the initial 0xHEX line to comment output.
   * @default false
   */
  noPrefixHex?: boolean;

  /**
   * The '--' separating bytes from description must be in at least this
   * column.
   * @default 0
   */
  minCol: number;
}
export type RequiredCommentOptions = Required<CommentOptions>;

export interface WriterOptions {
  chunkSize?: number;
}

export type RequiredWriterOptions = Required<WriterOptions>;

export interface EncodeOptions extends WriterOptions {
  /**
   * Encode all integers as floating point numbers of the correct size.
   * @default false
   */
  avoidInts?: boolean;

  /**
   * Should bigints that can fit into normal integers be collapsed into
   * normal integers?
   * @default true
   */
  collapseBigInts?: boolean;

  /**
   * When writing floats, always use the 64-bit version.  Often combined with
   * `avoidInts`.
   * @default false
   */
  float64?: boolean;

  /**
   * How to write TypedArrays?
   * Null to use the current platform's endian-ness.
   * True to always use little-endian.
   * False to always use big-endian.
   * @default null
   */
  forceEndian?: boolean | null;

  /**
   * Ignore sizes on boxed numbers; they might be overly-large.
   * @default false
   */
  ignoreOriginalEncoding?: boolean;

  /**
   * Do not encode numbers in the range  [CBOR_NEGATIVE_INT_MAX ...
   * STANDARD_NEGATIVE_INT_MAX - 1] as MT 1.
   * @default false
   */
  largeNegativeAsBigInt?: boolean;

  /**
   * Do not encode bigints that cannot be reduced to integers.
   * @default false
   */
  rejectBigInts?: boolean;

  /**
   * If true, error instead of encoding an instance of Simple.
   * @default false
   */
  rejectCustomSimples?: boolean;

  /**
   * Check that Maps do not contain keys that encode to the same bytes as
   * one another.  This is possible in a Map with object keys.
   * @default false
   */
  rejectDuplicateKeys?: boolean;

  /**
   * Do not encode floating point numbers that cannot be reduced to integers.
   * @default false
   */
  rejectFloats?: boolean;

  /**
   * If true, error instead of encoding `undefined`.
   * @default false
   */
  rejectUndefined?: boolean;

  /**
   * If true, encode -0 as 0.
   * @default false
   */
  simplifyNegativeZero?: boolean;

  /**
   * How should the key/value pairs be sorted before an object or Map
   * gets created?  If null, no sorting is performed.
   * @default null
   */
  sortKeys?: KeySorter | null;
}

export type RequiredEncodeOptions = Required<EncodeOptions>;
