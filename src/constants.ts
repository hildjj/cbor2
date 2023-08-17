/* eslint-disable @typescript-eslint/no-extraneous-class */
/**
 * Major Types.
 *
 * @enum {number}
 */
export const MT = {
  POS_INT: 0,
  NEG_INT: 1,
  BYTE_STRING: 2,
  UTF8_STRING: 3,
  ARRAY: 4,
  MAP: 5,
  TAG: 6,
  SIMPLE_FLOAT: 7,
};

/**
 * Known tag numbers.
 * See https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
 * for more information.
 *
 * @enum {number}
 */
export const TAG = {
  DATE_STRING: 0,
  DATE_EPOCH: 1,
  POS_BIGINT: 2,
  NEG_BIGINT: 3,
  DECIMAL_FRAC: 4,
  BIGFLOAT: 5,
  BASE64URL_EXPECTED: 21,
  BASE64_EXPECTED: 22,
  BASE16_EXPECTED: 23,
  CBOR: 24,
  URI: 32,
  BASE64URL: 33,
  BASE64: 34,
  MIME: 36,
  // https://github.com/input-output-hk/cbor-sets-spec/blob/master/CBOR_SETS.md
  SET: 258,
  JSON: 262,
  REGEXP: 21066,
  SELF_DESCRIBED: 55799,
  // Always invalid: https://www.ietf.org/archive/id/draft-bormann-cbor-notable-tags-07.html#name-invalid-tag
  INVALID_16: 0xffff,
  INVALID_32: 0xffffffff,
  INVALID_64: 0xffffffffffffffffn,
};

/**
 * Additional information markers for how many extra bytes to read.
 *
 * @enum {number}
 */
export const NUMBYTES = {
  ZERO: 0,
  ONE: 24,
  TWO: 25,
  FOUR: 26,
  EIGHT: 27,
  INDEFINITE: 31,
};

/**
 * Defined Simple numbers.
 *
 * @enum {number}
 */
export const SIMPLE = {
  FALSE: 20,
  TRUE: 21,
  NULL: 22,
  UNDEFINED: 23,
};

/**
 * Symbols.  Made globally findable for testing.  Note that this is a class
 * so that TypeScript can see each of these as a "unique symbol", which can
 * then have `typeof` applied to it.
 */
export class SYMS {
  /**
   * A 0xFF byte as been found in the stream.  Used as a sentinal.
   */
  public static readonly BREAK = Symbol.for('github.com/hildjj/cbor2/break');

  /**
   * Return from toCBOR to signal that we are done encoding, and that the
   * return value should be ignored.
   */
  public static readonly DONE = Symbol.for('github.com/hildjj/cbor2/done');

  /**
   * Nothing was found when decoding an item.  This should never be seen, since
   * an exception should be thrown for short input first.
   */
  public static readonly NOT_FOUND = Symbol.for('github.com/hildjj/cbor2/notFound');

  /**
   * Number of bytes received for a BigInt, for round-tripping.
   */
  public static readonly BIGINT_LEN = Symbol.for('github.com/hildjj/cbor2/BigIntLen');
}
