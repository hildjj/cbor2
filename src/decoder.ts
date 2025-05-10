import type {
  DecodeOptions,
  MtAiValue,
  Parent,
  RequiredDecodeOptions,
} from './options.js';
import {DecodeStream, type ValueGenerator} from './decodeStream.js';
import {CBORcontainer} from './container.js';
import {SYMS} from './constants.js';

function normalizeOptions(
  options: DecodeOptions
): RequiredDecodeOptions {
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
 * Internal state machine for turning a stream of MtAiValue tuples into
 * a JS value.
 */
class StateMachine {
  /**
   * Top-most pending parent.
   */
  public parent: Parent | undefined = undefined;

  /**
   * If parent is undefined, the current value from the stream.
   */
  public ret: unknown = undefined;

  /**
   * Go to the next state based on the event.
   *
   * @param mav Next event to process
   * @param opts Stream options
   * @param stream Currently-reading stream.  Will be advanced.
   */
  public step(
    mav: MtAiValue,
    opts: RequiredDecodeOptions,
    stream: DecodeStream
  ): void {
    this.ret = CBORcontainer.create(mav, this.parent, opts, stream);

    if (mav[2] === SYMS.BREAK) {
      if (this.parent?.isStreaming) {
        this.parent.left = 0;
      } else {
        throw new Error('Unexpected BREAK');
      }
    } else if (this.parent) {
      this.parent.push(this.ret, stream, mav[3]);
    }

    if (this.ret instanceof CBORcontainer) {
      this.parent = this.ret;
    }

    // Convert all finished parents in the chain to the correct type, replacing
    // in *their* parents as necessary.
    while (this.parent?.done) {
      this.ret = this.parent.convert(stream);

      const p = this.parent.parent;
      p?.replaceLast(this.ret, this.parent, stream);
      this.parent = p;
    }
  }
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
  const state = new StateMachine();

  for (const mav of stream) {
    state.step(mav, opts, stream);
  }
  return state.ret as T;
}

/**
  * Decode the bytes of a CBOR Sequence to major-type/additional-information/
  * value tuples.  Each of these tuples is an event in parsing the sequence.
  *
  * Note that this includes items indicating the start of an array or map, and
  * the end of an indefinite-length item, and tag numbers separate from the
  * tag content. Does not guarantee that the input is valid.
  *
  * Will attempt to read all items in an array or map, even if indefinite.
  * Throws when there is insufficient data to do so. The same applies when
  * reading tagged items, byte strings and text strings.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8742.html
 * @example
 * ```js
 * const s = new Sequence(buffer);
 * for (const [majorType, additionalInfo, value] of s.seq()) {
 *  ...
 * }
 * ```
 */
export class SequenceEvents {
  #seq: ValueGenerator;
  #peeked: MtAiValue | undefined;

  /**
   * Create an Even
   * @param src CBOR bytes to decode.
   * @param options Options for decoding.
   */
  public constructor(src: Uint8Array | string, options: DecodeOptions = {}) {
    const stream = new DecodeStream(src, normalizeOptions(options));
    this.#seq = stream.seq();
  }

  /**
   * Peek at the next tuple, allowing for later reads.
   *
   * @throws {Error} On insufficient data.
   */
  public peek(): MtAiValue | undefined {
    if (!this.#peeked) {
      this.#peeked = this.#next();
    }
    return this.#peeked;
  }

  /**
   * Read the next tuple.
   *
   * @throws {Error} On insufficient data.
   */
  public read(): MtAiValue | undefined {
    const mav = this.#peeked ?? this.#next();
    this.#peeked = undefined;
    return mav;
  }

  /**
   * Iterate over all tuples.
   *
   * @throws {Error} On insufficient data.
   */
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

/**
 * Decode a CBOR Sequence consisting of multiple CBOR items.
 *
 * @param src CBOR bytes to decode.
 * @param options Options for decoding.
 * @yields JS value decoded from CBOR sequence.
 * @see https://www.rfc-editor.org/rfc/rfc8742.html
 */
export function *decodeSequence<T = unknown>(
  src: Uint8Array | string,
  options: DecodeOptions = {}
): Generator<T, undefined, undefined> {
  const opts = normalizeOptions(options);
  const stream = new DecodeStream(src, opts);
  const state = new StateMachine();

  for (const mav of stream.seq()) {
    state.step(mav, opts, stream);
    if (!state.parent) {
      yield state.ret as T;
    }
  }
}
