import {DCBOR_INT, MT, NUMBYTES} from './constants.js';
import {
  type DecodeOptions,
  DiagnosticSizes,
  type MtAiValue,
  type Parent,
  type RequiredDecodeOptions,
  RequiredEncodeOptions,
} from './options.js';
import {type KeyValueEncoded, sortCoreDeterministic} from './sorts.js';
import {box, getEncoded, saveEncoded} from './box.js';
import {defaultEncodeOptions, encode} from './encoder.js';
import {stringToHex, u8concat, u8toHex} from './utils.js';
import {DecodeStream} from './decodeStream.js';
import {Simple} from './simple.js';
import {Tag} from './tag.js';
import {checkSubnormal} from './float.js';

const LENGTH_FOR_AI = new Map([
  [NUMBYTES.ZERO, 1],
  [NUMBYTES.ONE, 2],
  [NUMBYTES.TWO, 3],
  [NUMBYTES.FOUR, 5],
  [NUMBYTES.EIGHT, 9],
]);

const EMPTY_BUF = new Uint8Array(0);

function createObject(
  kve: KeyValueEncoded[],
  opts: RequiredDecodeOptions
): unknown {
  // Extra array elements are ignored in both branches.
  return !opts.boxed && !opts.preferMap && kve.every(([k]) => typeof k === 'string') ?
    Object.fromEntries(kve) :
    new Map<unknown, unknown>(kve as unknown as [unknown, unknown][]);
}

/**
 * A CBOR data item that can contain other items.  One of:
 *
 * - Array (streaming or concrete).
 * - Map (streaming or concrete).
 * - Tag (always one item).
 * - Streaming byte arrays or UTF8 arrays.
 *
 * This is used in various decoding applications to keep track of state.
 */
export class CBORcontainer {
  public static defaultDecodeOptions: RequiredDecodeOptions = {
    ...DecodeStream.defaultOptions,
    ParentType: CBORcontainer,
    boxed: false,
    cde: false,
    dcbor: false,
    diagnosticSizes: DiagnosticSizes.PREFERRED,
    convertUnsafeIntsToFloat: false,
    createObject,
    pretty: false,
    preferMap: false,
    rejectLargeNegatives: false,
    rejectBigInts: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectInts: false,
    rejectLongLoundNaN: false,
    rejectLongFloats: false,
    rejectNegativeZero: false,
    rejectSimple: false,
    rejectStreaming: false,
    rejectStringsNotNormalizedAs: null,
    rejectSubnormals: false,
    rejectUndefined: false,
    rejectUnsafeFloatInts: false,
    saveOriginal: false,
    sortKeys: null,
    tags: null,
    ignoreGlobalTags: true,
  };

  /**
   * Throw errors when decoding for bytes that were not encoded with {@link
   * https://www.ietf.org/archive/id/draft-ietf-cbor-cde-05.html CBOR Common
   * Deterministic Encoding Profile}.
   *
   * CDE does not mandate this checking, so it is up to the application
   * whether it wants to ensure that inputs were not encoded incompetetently
   * or maliciously.  To turn all of these on at once, set the cbor option to
   * true.
   */
  public static cdeDecodeOptions: DecodeOptions = {
    cde: true,
    rejectStreaming: true,
    requirePreferred: true,
    sortKeys: sortCoreDeterministic,
  };

  /**
   * Throw errors when decoding for bytes that were not encoded with {@link
   * https://www.ietf.org/archive/id/draft-mcnally-deterministic-cbor-11.html
   * dCBOR: A Deterministic CBOR Application Profile}.
   *
   * The dCBOR spec mandates that these errors be thrown when decoding dCBOR.
   * Turn this on by setting the `dcbor` option to true, which also enables
   * `cde` mode.
   */
  public static dcborDecodeOptions: DecodeOptions = {
    ...this.cdeDecodeOptions,
    dcbor: true,
    convertUnsafeIntsToFloat: true,
    rejectDuplicateKeys: true,
    rejectLargeNegatives: true,
    rejectLongLoundNaN: true,
    rejectLongFloats: true,
    rejectNegativeZero: true,
    rejectSimple: true,
    rejectUndefined: true,
    rejectUnsafeFloatInts: true,
    rejectStringsNotNormalizedAs: 'NFC',
  };

  public parent: Parent | undefined;
  public mt: number;
  public ai: number;
  public left: number;
  public offset: number;
  public count = 0;
  public children: Tag | unknown[] = [];
  public depth = 0;
  #opts: RequiredDecodeOptions;
  #encodedChildren: Uint8Array[] | null = null;

  // Only call new from create() and super().
  public constructor(
    mav: MtAiValue,
    left: number,
    parent: Parent | undefined,
    opts: RequiredDecodeOptions
  ) {
    [this.mt, this.ai, , this.offset] = mav;
    this.left = left;
    this.parent = parent;
    this.#opts = opts;
    if (parent) {
      this.depth = parent.depth + 1;
    }

    if (this.mt === MT.MAP) {
      if (this.#opts.sortKeys || this.#opts.rejectDuplicateKeys) {
        this.#encodedChildren = [];
      }
    }
    if (this.#opts.rejectStreaming && (this.ai === NUMBYTES.INDEFINITE)) {
      throw new Error('Streaming not supported');
    }
  }

  public get isStreaming(): boolean {
    return this.left === Infinity;
  }

  public get done(): boolean {
    return this.left === 0;
  }

  /**
   * Factory method that returns the given ParentType if the mt/ai dictate
   * that is necessary, otherwise returns the given value.
   *
   * @param mav Major Type, Additional Information, and Associated value from
   *   token.
   * @param parent If this item is inside another item, the direct parent.
   * @param opts Options controlling creation.
   * @param stream The stream being decoded from.
   * @returns ParentType instance or value.
   * @throws Invalid major type, which should only occur from tests.
   */
  public static create(
    mav: MtAiValue,
    parent: Parent | undefined,
    opts: RequiredDecodeOptions,
    stream: DecodeStream
  ): unknown {
    const [mt, ai, value, offset] = mav;
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT: {
        if (opts.rejectInts) {
          throw new Error(`Unexpected integer: ${value}`);
        }
        if (opts.rejectLargeNegatives &&
            (value as bigint < -0x8000000000000000n)) {
          throw new Error(`Invalid 65bit negative number: ${value}`);
        }
        let val = value;
        if (opts.convertUnsafeIntsToFloat &&
          (val as bigint >= DCBOR_INT.MIN) &&
          (val as bigint <= DCBOR_INT.MAX)) {
          val = Number(value);
        }
        if (opts.boxed) {
          return box(val as number, stream.toHere(offset));
        }
        return val;
      }
      case MT.SIMPLE_FLOAT:
        if (ai > NUMBYTES.ONE) {
          if (opts.rejectFloats) {
            throw new Error(`Decoding unwanted floating point number: ${value}`);
          }
          if (opts.rejectNegativeZero && Object.is(value, -0)) {
            throw new Error('Decoding negative zero');
          }
          if (opts.rejectLongLoundNaN && isNaN(value as number)) {
            const buf = stream.toHere(offset);
            if (buf.length !== 3 || buf[1] !== 0x7e || buf[2] !== 0) {
              throw new Error(`Invalid NaN encoding: "${u8toHex(buf)}"`);
            }
          }
          if (opts.rejectSubnormals) {
            // Skip the size byte
            checkSubnormal(stream.toHere(offset + 1));
          }
          if (opts.rejectLongFloats) {
            // No other opts needed.
            const buf = encode(value, {
              chunkSize: 9,
              reduceUnsafeNumbers: opts.rejectUnsafeFloatInts,
            });
            if ((buf[0] >> 5) !== mt) {
              throw new Error(`Should have been encoded as int, not float: ${value}`);
            }
            // Known safe:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (buf.length < LENGTH_FOR_AI.get(ai)!) {
              throw new Error(`Number should have been encoded shorter: ${value}`);
            }
          }
          if ((typeof value === 'number') && opts.boxed) {
            // Not symbols
            return box(value, stream.toHere(offset));
          }
        } else {
          if (opts.rejectSimple) {
            if (value instanceof Simple) {
              throw new Error(`Invalid simple value: ${value}`);
            }
          }
          if (opts.rejectUndefined) {
            if (value === undefined) {
              throw new Error('Unexpected undefined');
            }
          }
        }
        return value;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (value === Infinity) {
          return new opts.ParentType(mav, Infinity, parent, opts);
        }
        if (opts.rejectStringsNotNormalizedAs && (typeof value === 'string')) {
          const n = (value as string).normalize(
            opts.rejectStringsNotNormalizedAs
          );
          if (value !== n) {
            throw new Error(`String not normalized as "${opts.rejectStringsNotNormalizedAs}", got [${stringToHex(value as string)}] instead of [${stringToHex(n)}]`);
          }
        }

        if (opts.boxed) {
          return box(value as string, stream.toHere(offset));
        }
        return value;
      case MT.ARRAY:
        return new opts.ParentType(mav, value as number, parent, opts);
      case MT.MAP:
        return new opts.ParentType(mav, (value as number) * 2, parent, opts);
      case MT.TAG: {
        const ret = new opts.ParentType(mav, 1, parent, opts);
        ret.children = new Tag(value as number);
        return ret;
      }
    }
    throw new TypeError(`Invalid major type: ${mt}`);
  }

  public static decodeToEncodeOpts(
    decode: RequiredDecodeOptions
  ): RequiredEncodeOptions {
    // Options to re-encode when decoding, to check for sort order in tags
    // Most important is ignoreOriginalEncoding=false,
    // which should make most of the rest of these moot, except for numbers
    // when we are not boxed.
    // Of all of these, sortKeys is the one that is likely to be relevant
    // and non-trivial.
    // This is almost certainly not quite right, and is currently only used
    // for tag 258.
    return {
      ...defaultEncodeOptions,
      avoidInts: decode.rejectInts,
      float64: !decode.rejectLongFloats,
      flushToZero: decode.rejectSubnormals,
      largeNegativeAsBigInt: decode.rejectLargeNegatives,
      sortKeys: decode.sortKeys,
    };
  }

  /**
   * Add the given child to the list of children, and update how many are
   * still needed.
   *
   * @param child Any child item.
   * @param stream Stream being read from.
   * @param offset Offset of start of child in stream.
   * @returns The number of items still needed.
   */
  public push(child: unknown, stream: DecodeStream, offset: number): number {
    this.children.push(child);

    if (this.#encodedChildren) {
      const buf = getEncoded(child) || stream.toHere(offset);

      // For simple children, this will be the encoded form of the child.
      // For complex children, this will be just the beginning (MT/AI/LEN)
      // and will be replaced in replaceLast.
      this.#encodedChildren.push(buf);
    }
    return --this.left;
  }

  /**
   * Replace the last child with this one.  Usually after having called
   * convert on the most recent child.
   *
   * @param child New child value.
   * @param item The key or value container.  Used to check for dups.
   * @param stream The stream being read from.
   * @returns Previous child value.
   * @throws Duplicate key.
   */
  public replaceLast(
    child: unknown,
    item: Parent,
    stream: DecodeStream
  ): unknown {
    let ret: unknown = undefined;
    let last = -Infinity;
    if (this.children instanceof Tag) {
      last = 0;
      ret = this.children.contents;
      this.children.contents = child;
    } else {
      last = this.children.length - 1;
      ret = this.children[last];
      this.children[last] = child;
    }

    if (this.#encodedChildren) {
      const buf = getEncoded(child) || stream.toHere(item.offset);
      this.#encodedChildren[last] = buf;
    }
    return ret;
  }

  /**
   * Converts the childen to the most appropriate form known.
   *
   * @param stream Stream that we are reading from.
   * @returns Anything BUT a CBORcontainer.
   * @throws Invalid major type.  Only possible in testing.
   */
  public convert(stream: DecodeStream): unknown {
    let ret: unknown = undefined;
    switch (this.mt) {
      case MT.ARRAY:
        ret = this.children;
        break;
      case MT.MAP: {
        // Are all of the keys strings?
        // Note that __proto__ gets special handling as a key in fromEntries,
        // since it's doing DefineOwnProperty down inside.
        const pu = this.#pairs();
        if (this.#opts.sortKeys) {
          let lastKey: KeyValueEncoded | undefined = undefined;
          for (const kve of pu) {
            if (lastKey) {
              if (this.#opts.sortKeys(lastKey, kve) >= 0) {
                throw new Error(`Duplicate or out of order key: "0x${kve[2]}"`);
              }
            }
            lastKey = kve;
          }
        } else if (this.#opts.rejectDuplicateKeys) {
          const ks = new Set<string>();
          for (const [_k, _v, e] of pu) {
            const hex = u8toHex(e);
            if (ks.has(hex)) {
              throw new Error(`Duplicate key: "0x${hex}"`);
            }
            ks.add(hex);
          }
        }

        ret = this.#opts.createObject(pu, this.#opts);
        break;
      }
      case MT.BYTE_STRING: {
        return u8concat(this.children as Uint8Array[]);
      }
      case MT.UTF8_STRING: {
        const str = (this.children as string[]).join('');
        ret = this.#opts.boxed ?
          box(str, stream.toHere(this.offset)) :
          str;
        break;
      }
      case MT.TAG:
        ret = (this.children as Tag).decode(this.#opts);
        break;
      default:
        throw new TypeError(`Invalid mt on convert: ${this.mt}`);
    }
    if (this.#opts.saveOriginal && ret && (typeof ret === 'object')) {
      saveEncoded(ret, stream.toHere(this.offset));
    }
    return ret;
  }

  #pairs(): KeyValueEncoded[] {
    const ary = this.children as unknown[];
    const len = ary.length;
    if (len % 2) {
      throw new Error('Missing map value');
    }
    const ret = new Array<KeyValueEncoded>(len / 2);
    if (this.#encodedChildren) {
      for (let i = 0; i < len; i += 2) {
        ret[i >> 1] = [ary[i], ary[i + 1], this.#encodedChildren[i]];
      }
    } else {
      for (let i = 0; i < len; i += 2) {
        ret[i >> 1] = [ary[i], ary[i + 1], EMPTY_BUF];
      }
    }
    return ret;
  }
}
