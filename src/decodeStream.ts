import {
  MT,
  NUMBYTES,
  SIMPLE,
  SYMS,
} from './constants.js';
import {base64ToBytes, hexToU8} from './utils.js';
import {Simple} from './simple.js';
import {parseHalf} from './float.js';

const TD = new TextDecoder('utf8', {fatal: true, ignoreBOM: true});

/**
 * Options for decoding.
 */
export interface DecodeOptions {
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
export type DecodeValue =
  Simple | Symbol | Uint8Array | bigint | boolean | number | string |
  null | undefined;

/**
 * Information about a decoded CBOR data item.  3-element tuple, containing:
 * - Major type.
 * - Additional Information (int if < 23, else length as 24-27, 31 as stream).
 * - Decoded token value.
 */
export type MtAiValue = [mt: number, ai: number, val: DecodeValue];

export type ValueGenerator = Generator<MtAiValue, undefined, undefined>;

/**
 * Decode bytes into a stream of events describing the CBOR read from the
 * bytes.  Currently requires a full single CBOR value, with no extra bytes in
 * the input.
 */
export class DecodeStream {
  #src;
  #view;
  #offset = 0;
  #opts: Required<DecodeOptions>;

  public constructor(src: Uint8Array, opts?: DecodeOptions);
  public constructor(
    src: string,
    opts: Omit<DecodeOptions, 'encoding'> & Required<Pick<DecodeOptions, 'encoding'>>
  );

  public constructor(src: Uint8Array | string, opts?: DecodeOptions) {
    this.#opts = {
      maxDepth: 1024,
      encoding: null,
      ...opts,
    };

    if (typeof src === 'string') {
      switch (this.#opts.encoding) {
        case 'hex':
          this.#src = hexToU8(src);
          break;
        case 'base64':
          this.#src = base64ToBytes(src);
          break;
        default:
          throw new TypeError(`Encoding not implemented: "${this.#opts.encoding}"`);
      }
    } else {
      this.#src = src;
    }

    this.#view = new DataView(
      this.#src.buffer,
      this.#src.byteOffset,
      this.#src.byteLength
    );
  }

  /**
   * Get the stream of events describing the CBOR item.
   *
   * @throws On invalid input or extra data in input.
   * @example
   * ```js
   * const s = new DecodeStream(buffer);
   * for (const [majorType, additionalInfo, value] of s) {
   *  ...
   * }
   * ```
   */
  public *[Symbol.iterator](): ValueGenerator {
    yield *this.#nextVal(0);
    if (this.#offset !== this.#src.length) {
      throw new Error('Extra data in input');
    }
  }

  /**
   * Get the next CBOR value from the input stream.
   *
   * @param depth The current depth in the CBOR tree.
   * @returns A generator that yields information about every sub-item
   *   found in the input.
   * @throws Maximum depth exceeded, invalid input.
   */
  *#nextVal(depth: number): ValueGenerator {
    if (depth++ > this.#opts.maxDepth) {
      throw new Error(`Maximum depth ${this.#opts.maxDepth} exceeded`);
    }

    // Will throw when out of data
    const octet = this.#view.getUint8(this.#offset++);
    const mt = octet >> 5;
    const ai = octet & 0x1f;
    let val: DecodeValue = ai;
    let simple = false;

    switch (ai) {
      case NUMBYTES.ONE:
        val = this.#view.getUint8(this.#offset++);
        if (mt === MT.SIMPLE_FLOAT) {
          // An encoder MUST NOT issue two-byte sequences that start with 0xf8
          // (major type 7, additional information 24) and continue with a
          // byte less than 0x20 (32 decimal). Such sequences are not
          // well-formed.
          if (val < 0x20) {
            throw new Error(`Invalid simple encoding in extra byte: ${val}`);
          }
          simple = true;
        }
        break;
      case NUMBYTES.TWO:
        if (mt === MT.SIMPLE_FLOAT) {
          val = parseHalf(this.#src, this.#offset);
        } else {
          val = this.#view.getUint16(this.#offset, false);
        }
        this.#offset += 2;
        break;
      case NUMBYTES.FOUR:
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat32(this.#offset, false);
        } else {
          val = this.#view.getUint32(this.#offset, false);
        }
        this.#offset += 4;
        break;
      case NUMBYTES.EIGHT: {
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat64(this.#offset, false);
        } else {
          val = this.#view.getBigUint64(this.#offset, false);
          if (val <= Number.MAX_SAFE_INTEGER) {
            val = Number(val);
          }
        }
        this.#offset += 8;
        break;
      }
      case 28:
      case 29:
      case 30:
        throw new Error(`Additional info not implemented: ${ai}`);
      case NUMBYTES.INDEFINITE:
        switch (mt) {
          case MT.POS_INT:
          case MT.NEG_INT:
          case MT.TAG:
            throw new Error(`Invalid indefinite encoding for MT ${mt}`);
          case MT.SIMPLE_FLOAT:
            yield [mt, ai, SYMS.BREAK];
            return;
        }
        val = Infinity;
        break;
      default:
        simple = true;
    }

    switch (mt) {
      case MT.POS_INT:
        yield [mt, ai, val];
        break;
      case MT.NEG_INT:
        yield [mt, ai, (typeof val === 'bigint') ? -1n - val : -1 - Number(val)];
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          yield *this.#stream(mt, depth);
        } else {
          yield [mt, ai, this.#read(val as number)];
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          yield *this.#stream(mt, depth);
        } else {
          yield [mt, ai, TD.decode(this.#read(val as number))];
        }
        break;
      case MT.ARRAY:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval];
          for (let i = 0; i < nval; i++) {
            yield *this.#nextVal(depth + 1);
          }
        }
        break;
      case MT.MAP:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval];
          for (let i = 0; i < nval; i++) {
            yield *this.#nextVal(depth);
            yield *this.#nextVal(depth);
          }
        }
        break;
      case MT.TAG:
        yield [mt, ai, val];
        yield *this.#nextVal(depth);
        break;
      case MT.SIMPLE_FLOAT:
        if (simple) {
          switch (val) {
            case SIMPLE.FALSE: val = false; break;
            case SIMPLE.TRUE: val = true; break;
            case SIMPLE.NULL: val = null; break;
            case SIMPLE.UNDEFINED: val = undefined; break;
            default: val = new Simple(Number(val));
          }
        }
        yield [mt, ai, val];
        break;
    }
  }

  #read(size: number): Uint8Array {
    const a = this.#src.subarray(this.#offset, (this.#offset += size));
    if (a.length !== size) {
      throw new Error('Unexpected nd of stream');
    }
    return a;
  }

  *#stream(mt: number, depth: number, check = true): ValueGenerator {
    yield [mt, NUMBYTES.INDEFINITE, Infinity];

    while (true) {
      const child = this.#nextVal(depth);
      const first = child.next();

      // Assert: first.done is always true here, or nextVal would have
      // thrown an exception on insufficient data.
      const [nmt, ai, val] = first.value as MtAiValue;
      if (val === SYMS.BREAK) {
        yield first.value as MtAiValue;
        // Assert: this will return done.  It just cleans up the generator
        // and causes the return statement after the yield of BREAK to run.
        child.next();
        return;
      }
      if (check) {
        if (nmt !== mt) {
          throw new Error(`Unmatched major type.  Expected ${mt}, got ${nmt}.`);
        }
        if (ai === NUMBYTES.INDEFINITE) {
          throw new Error('New stream started in typed stream');
        }
      }
      yield first.value as MtAiValue;
      yield *child;
    }
  }
}
