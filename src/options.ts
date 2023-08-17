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
    opts: RequiredContainerOptions
  ): Parent;
}

export interface Tg {
  decode(options: RequiredContainerOptions): unknown;
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
export interface ContainerOptions extends DecodeStreamOptions {
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
}

export type RequiredContainerOptions = Required<ContainerOptions>;
