import type {DecodeOptions, MtAiValue, Parent} from './options.js';
import {DecodeStream, type ValueGenerator} from './decodeStream.js';
import {CBORcontainer} from './container.js';
import {SYMS} from './constants.js';

function normalizeOptions(
  options: DecodeOptions
): Required<DecodeOptions> {
  const opts = {...CBORcontainer.defaultDecodeOptions};
  if (options.dcbor) {
    Object.assign(opts, CBORcontainer.dcborDecodeOptions);
  } else if (options.cde) {
    Object.assign(opts, CBORcontainer.cdeDecodeOptions);
  }
  Object.assign(opts, options);

  if (Object.hasOwn(opts, 'rejectLongNumbers')) {
    throw new TypeError('rejectLongNumbers has changed to requirePreferred');
  }

  if (opts.boxed) {
    opts.saveOriginal = true;
  }

  return opts;
}

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param options Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function decode<T = unknown>(
  src: Uint8Array | string,
  options: DecodeOptions = {}
): T {
  const opts = normalizeOptions(options);
  const stream = new DecodeStream(src, opts);
  let parent: Parent | undefined = undefined;
  let ret: unknown = undefined;

  for (const mav of stream) {
    ret = CBORcontainer.create(mav, parent, opts, stream);

    if (mav[2] === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 0;
      } else {
        throw new Error('Unexpected BREAK');
      }
    } else if (parent) {
      parent.push(ret, stream, mav[3]);
    }

    if (ret instanceof CBORcontainer) {
      parent = ret;
    }

    // Convert all finished parents in the chain to the correct type, replacing
    // in *their* parents as necessary.
    while (parent?.done) {
      ret = parent.convert(stream);

      const p = parent.parent;
      p?.replaceLast(ret, parent, stream);
      parent = p;
    }
  }
  return ret as T;
}

/**
 * Decode CBOR Sequence bytes to major-type/additional-information/value tuples.
 */
export class Sequence {
  #seq: ValueGenerator;
  #peeked: MtAiValue | undefined;

  public constructor(src: Uint8Array | string, options: DecodeOptions = {}) {
    const stream = new DecodeStream(src, normalizeOptions(options));
    this.#seq = stream.seq();
  }

  /** Peek at the next tuple, allowing for later reads. */
  public peek(): MtAiValue | undefined {
    if (!this.#peeked) {
      this.#peeked = this.#next();
    }
    return this.#peeked;
  }

  /** Read the next tuple. */
  public read(): MtAiValue | undefined {
    const mav = this.#peeked ?? this.#next();
    this.#peeked = undefined;
    return mav;
  }

  /** Iterate over all tuples. */
  public *[Symbol.iterator](): Generator<MtAiValue, void, undefined> {
    while (true) {
      const tuple = this.read();

      if (!tuple) {
        return;
      }

      yield tuple;
    }
  }

  #next(): MtAiValue | undefined {
    const {value: tuple, done} = this.#seq.next();
    if (done) {
      return undefined;
    }

    return tuple;
  }
}
