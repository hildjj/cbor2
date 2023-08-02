import {MT, NUMBYTES, SYMS} from './constants.js';
import type {Writer} from './writer.js';
import {halfToUint} from './float.js';

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

  public toCBOR(w: Writer): typeof SYMS.DONE {
    if (this.#ai !== NUMBYTES.ZERO) {
      w.writeUint8((this.#mt << 5) | this.#ai);
    }
    let val = this.valueOf();
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
              throw new Error('Half does not fit');
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
