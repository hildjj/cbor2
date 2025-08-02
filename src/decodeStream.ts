import type {DecodeStreamOptions, DecodeValue, MtAiValue, Sliceable} from './options.js';
import {
  MT,
  NUMBYTES,
  SYMS,
} from './constants.js';
import {base64ToBytes, hexToU8, subarrayRanges} from './utils.js';
import {Simple} from './simple.js';
import {parseHalf} from './float.js';

const TD = new TextDecoder('utf8', {fatal: true, ignoreBOM: true});

export type ValueGenerator = Generator<MtAiValue, undefined, undefined>;

/**
 * Decode bytes into a stream of events describing the CBOR read from the
 * bytes.  Currently requires a full single CBOR value, with no extra bytes in
 * the input.
 */
export class DecodeStream implements Sliceable {
  public static defaultOptions: Required<DecodeStreamOptions> = {
    maxDepth: 1024,
    encoding: 'hex',
    requirePreferred: false,
  };

  #src;
  #view;
  #offset = 0;
  #opts: Required<DecodeStreamOptions>;

  public constructor(src: Uint8Array | string, opts?: DecodeStreamOptions) {
    this.#opts = {
      ...DecodeStream.defaultOptions,
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
   * Get the chunk of this stream from the given position to the current offset.
   *
   * @param begin Position to read from.  Should be <= current offset.
   * @returns Subarray of input stream (not copy).
   */
  public toHere(begin: number): Uint8Array {
    return subarrayRanges(this.#src, begin, this.#offset);
  }

  /**
   * Get the stream of events describing the CBOR item.  Yields Value tuples.
   *
   * @throws On invalid input or extra data in input.
   * @yields MtAiValue for each value in the stream.
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
   * Get a stream of events describing all CBOR items in the input CBOR Sequence
   * consisting of multiple CBOR items. Yields Value tuples.
   *
   * Note that this includes items indicating the start of an array or map, and
   * the end of an indefinite-length item, and tag numbers separate from the tag
   * content. Does not guarantee that the input is valid.
   *
   * Will attempt to read all items in an array or map, even if indefinite.
   * Throws when there is insufficient data to do so. The same applies when
   * reading tagged items, byte strings and text strings.
   *
   * @throws On insufficient data.
   * @yields MtAiValue for each value in the sequence.
   * @example
   * ```js
   * const s = new DecodeStream(buffer);
   * for (const [majorType, additionalInfo, value] of s.seq()) {
   *  ...
   * }
   * ```
   */
  public *seq(): ValueGenerator {
    // Repeatedly read the next value from the input, until the offset of the
    // next possible value is past the input length.
    //
    // Throws if their is insufficient data to read the next value. Otherwise,
    // within #nextVal the offset will be incremented to where it expects the
    // next item to be.
    //
    // Note that since we're producing each item, we don't need to track depth.
    //
    // Note that #nextVal takes care of reading array and map items and tag
    // content, which means this can still throw if there is insufficient data.
    //
    // Note that #nextVal ALWAYS consumes at least one byte.
    while (this.#offset < this.#src.length) {
      yield *this.#nextVal(0);
    }
  }

  /**
   * Get the next CBOR value from the input stream.  Yields Value tuples.
   *
   * @param depth The current depth in the CBOR tree.
   * @throws Maximum depth exceeded, invalid input.
   * @yields Information about every sub-item found in the input.
   */
  *#nextVal(depth: number): ValueGenerator {
    if (depth++ > this.#opts.maxDepth) {
      throw new Error(`Maximum depth ${this.#opts.maxDepth} exceeded`);
    }

    const prevOffset = this.#offset;
    // Will throw when out of data
    const octet = this.#view.getUint8(this.#offset++);
    const mt = octet >> 5;
    const ai = octet & 0x1f;
    let val: DecodeValue = ai;
    let simple = false;
    let len = 0;

    switch (ai) {
      case NUMBYTES.ONE:
        len = 1;
        val = this.#view.getUint8(this.#offset);
        if (mt === MT.SIMPLE_FLOAT) {
          // An encoder MUST NOT issue two-byte sequences that start with 0xf8
          // (major type 7, additional information 24) and continue with a
          // byte less than 0x20 (32 decimal). Such sequences are not
          // well-formed.
          if (val < 0x20) {
            throw new Error(`Invalid simple encoding in extra byte: ${val}`);
          }
          simple = true;
        } else if (this.#opts.requirePreferred && (val < 24)) {
          throw new Error(`Unexpectedly long integer encoding (1) for ${val}`);
        }
        break;
      case NUMBYTES.TWO:
        len = 2;
        if (mt === MT.SIMPLE_FLOAT) {
          val = parseHalf(this.#src, this.#offset);
        } else {
          val = this.#view.getUint16(this.#offset, false);
          if (this.#opts.requirePreferred && (val <= 0xff)) {
            throw new Error(`Unexpectedly long integer encoding (2) for ${val}`);
          }
        }
        break;
      case NUMBYTES.FOUR:
        len = 4;
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat32(this.#offset, false);
        } else {
          val = this.#view.getUint32(this.#offset, false);
          if (this.#opts.requirePreferred && (val <= 0xffff)) {
            throw new Error(`Unexpectedly long integer encoding (4) for ${val}`);
          }
        }
        break;
      case NUMBYTES.EIGHT: {
        len = 8;
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat64(this.#offset, false);
        } else {
          val = this.#view.getBigUint64(this.#offset, false);
          if (val <= Number.MAX_SAFE_INTEGER) {
            val = Number(val);
          }
          if (this.#opts.requirePreferred && (val <= 0xffffffff)) {
            throw new Error(`Unexpectedly long integer encoding (8) for ${val}`);
          }
        }
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
            yield [mt, ai, SYMS.BREAK, prevOffset, 0];
            return;
        }
        val = Infinity;
        break;
      default:
        simple = true;
    }
    this.#offset += len;

    switch (mt) {
      case MT.POS_INT:
        yield [mt, ai, val, prevOffset, len];
        break;
      case MT.NEG_INT:
        yield [mt, ai, (typeof val === 'bigint') ? -1n - val : -1 - Number(val), prevOffset, len];
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, prevOffset);
        } else {
          yield [mt, ai, this.#read(val as number), prevOffset, val];
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, prevOffset);
        } else {
          yield [mt, ai, TD.decode(this.#read(val as number)), prevOffset, val];
        }
        break;
      case MT.ARRAY:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, prevOffset, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval, prevOffset, len];
          for (let i = 0; i < nval; i++) {
            yield *this.#nextVal(depth + 1);
          }
        }
        break;
      case MT.MAP:
        if (val === Infinity) {
          yield *this.#stream(mt, depth, prevOffset, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval, prevOffset, len];
          for (let i = 0; i < nval; i++) {
            yield *this.#nextVal(depth);
            yield *this.#nextVal(depth);
          }
        }
        break;
      case MT.TAG:
        yield [mt, ai, val, prevOffset, len];
        yield *this.#nextVal(depth);
        break;
      case MT.SIMPLE_FLOAT: {
        const oval = val;
        if (simple) {
          val = Simple.create(Number(val));
        }
        yield [mt, ai, val, prevOffset, oval];
        break;
      }
    }
  }

  #read(size: number): Uint8Array {
    const a = subarrayRanges(this.#src, this.#offset, (this.#offset += size));
    if (a.length !== size) {
      throw new Error(`Unexpected end of stream reading ${size} bytes, got ${a.length}`);
    }
    return a;
  }

  *#stream(
    mt: number,
    depth: number,
    prevOffset: number,
    check = true
  ): ValueGenerator {
    yield [mt, NUMBYTES.INDEFINITE, Infinity, prevOffset, Infinity];

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
