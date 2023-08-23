import {type DoneEncoding, writeBigInt, writeNumber} from './encoder.js';
import {MT, NUMBYTES, SYMS, TAG} from './constants.js';
import type {RequiredEncodeOptions} from './options.js';
import type {Writer} from './writer.js';
import {halfToUint} from './float.js';
import {hexToU8} from './utils.js';

/**
 * A wrapper around JavaScripts boxed Number type which maintains the major
 * type and length from decoding, so that encoding will round-trip even when
 * cbor2 would have chosen a different encoding for the value.
 *
 * Since this is a subclass of Number, and JS knows how to coerce Number boxed
 * objects to plain numbers for arithmetic, you can still use these objects in
 * all of the places you would use a plain number, as far as is known at the
 * moment.
 */
export class CBORnumber extends Number {
  #mt: number;
  #ai: number;

  /**
   * Create a box.
   *
   * @param num The number to wrap.
   * @param mt The desired major type.  Must be POS_INT, NEG_INT, or
   *   SIMPLE_FLOAT.  Not all combinations are valid.
   * @param ai The number of bytes desired.  Must be 0 or 24-27.  Not all
   *   combinations are valid.
   */
  public constructor(num: number, mt: number, ai: number) {
    super(num);
    this.#mt = mt;
    this.#ai = ai;
  }

  public toCBOR(w: Writer, opts: RequiredEncodeOptions): typeof SYMS.DONE {
    let val = this.valueOf();
    if (opts.ignoreBoxes) {
      writeNumber(val, w, opts);
      return SYMS.DONE;
    }
    if (this.#ai !== NUMBYTES.ZERO) {
      w.writeUint8((this.#mt << 5) | this.#ai);
    }
    switch (this.#mt) {
      case MT.NEG_INT:
        val = -1 - val;
        // eslint-disable-next-line no-fallthrough
      case MT.POS_INT:
        switch (this.#ai) {
          case NUMBYTES.ZERO:
            w.writeUint8((this.#mt << 5) | val);
            break;
          case NUMBYTES.ONE:
            w.writeUint8(val);
            break;
          case NUMBYTES.TWO:
            w.writeUint16(val);
            break;
          case NUMBYTES.FOUR:
            w.writeUint32(val);
            break;
          case NUMBYTES.EIGHT:
            w.writeBigUint64(BigInt(val));
            break;
          default:
            throw new Error(`Invalid additional info: ${this.#ai}`);
        }
        break;
      case MT.SIMPLE_FLOAT:
        switch (this.#ai) {
          case NUMBYTES.ZERO:
          case NUMBYTES.ONE:
            throw new Error('Should be an instance of Simple');
          case NUMBYTES.TWO: {
            const v = halfToUint(val);
            if (v == null) {
              throw new Error(`Half does not fit: ${val}`);
            } else {
              w.writeUint16(v);
            }
            break;
          }
          case NUMBYTES.FOUR:
            w.writeFloat32(val);
            break;
          case NUMBYTES.EIGHT:
            w.writeFloat64(val);
            break;
        }
        break;
      default:
        throw new Error(`Invalid major type: ${this.#mt}`);
    }

    return SYMS.DONE;
  }
}

function bigIntToCBOR(
  this: BigInt,
  w: Writer,
  opts: RequiredEncodeOptions
): DoneEncoding | [number, unknown] {
  // BigInt isn't a real constructor, so we can't subclass it like we can
  // Number.

  /* eslint-disable no-invalid-this */
  const val = this.valueOf();
  if (!opts.ignoreBoxes && (SYMS.BIGINT_LEN in this)) {
    if (opts.rejectBigInts) {
      throw new Error(`Attempt to encode unwanted bigint: ${val}`);
    }

    // No reduction ever for boxed and be-symbol'd bigints.
    const orig_len = this[SYMS.BIGINT_LEN] as number;
    const neg = val < 0n;
    const pos = neg ? -val - 1n : val;
    const s = pos.toString(16);
    const len = Math.max(
      s.length + (s.length % 2 ? 1 : 0),
      2 * orig_len
    );
    const buf = hexToU8(s.padStart(len, '0'));
    return [neg ? TAG.NEG_BIGINT : TAG.POS_BIGINT, buf];
  }

  writeBigInt(val, w, opts);
  return SYMS.DONE;
  /* eslint-enable no-invalid-this */
}

/**
 * Create a box for a bigint, tagged appropriately so it will round-trip
 * exactly the same length that it came in.  The box should be usable anywhere
 * that you would do math on unboxed bigints.
 *
 * @param bi Bigint.
 * @param len Length of the original buffer holding the bigint.
 * @returns Box.
 */
export function boxedBigInt(bi: bigint, len: number): BigInt {
  const bio = Object(bi);
  bio[SYMS.BIGINT_LEN] = len;
  bio.toCBOR = bigIntToCBOR;
  return bio;
}
