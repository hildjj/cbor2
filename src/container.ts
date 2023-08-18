import {MT, NUMBYTES} from './constants.js';
import type {MtAiValue, Parent, RequiredDecodeOptions} from './options.js';
import {u8concat, u8toHex} from './utils.js';
import {CBORnumber} from './number.js';
import {DecodeStream} from './decodeStream.js';
import type {KeyValueEncoded} from './sorts.js';
import {Simple} from './simple.js';
import {Tag} from './tag.js';
import {encode} from './encoder.js';

const LENGTH_FOR_AI = new Map([
  [NUMBYTES.ZERO, 1],
  [NUMBYTES.ONE, 2],
  [NUMBYTES.TWO, 3],
  [NUMBYTES.FOUR, 5],
  [NUMBYTES.EIGHT, 9],
]);

const EMPTY_BUF = new Uint8Array(0);

// TODO: Decode on dCBOR approach
// export const dCBORdecodeOptions: ContainerOptions = {
//   reject65bitNegative: true,
//   rejectLongLoundNaN: true,
//   rejectLongNumbers: true,
//   rejectNegativeZero: true,
//   rejectSimple: true,
//   rejectStreaming: true,
//   sortKeys: sortCoreDeterministic,
// };

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
  public static defaultOptions: RequiredDecodeOptions = {
    ...DecodeStream.defaultOptions,
    ParentType: CBORcontainer,
    boxed: false,
    reject65bitNegative: false,
    rejectBigInts: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectLongLoundNaN: false,
    rejectLongNumbers: false,
    rejectNegativeZero: false,
    rejectSimple: false,
    rejectStreaming: false,
    sortKeys: null,
  };

  public parent: Parent | undefined;
  public mt: number;
  public ai: number;
  public left: number;
  public offset: number;
  public count = 0;
  public children: Tag | unknown[] = [];
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
      case MT.NEG_INT:
        if (opts.rejectLongNumbers && (ai > NUMBYTES.ZERO)) {
          // No opts needed
          const buf = encode(value, {chunkSize: 9});

          // Known safe:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (buf.length < LENGTH_FOR_AI.get(ai)!) {
            throw new Error(`Int should have been encoded shorter: ${value}`);
          }
        }
        if (opts.reject65bitNegative &&
            (value as number < -0x8000000000000000n)) {
          throw new Error(`Invalid 65bit negative number: ${value}`);
        }
        if (opts.boxed && (typeof value === 'number')) {
          return new CBORnumber(value, mt, ai);
        }
        return value;
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
          if (opts.rejectLongNumbers) {
            // No opts needed.
            const buf = encode(value, {chunkSize: 9});
            if ((buf[0] >> 5) !== mt) {
              throw new Error(`Should have been encoded as int, not float: ${value}`);
            }
            // Known safe:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (buf.length < LENGTH_FOR_AI.get(ai)!) {
              throw new Error(`Int should have been encoded shorter: ${value}`);
            }
          }
          if (opts.boxed) {
            return new CBORnumber(value as number, mt, ai);
          }
        } else if (opts.rejectSimple) {
          if (value instanceof Simple) {
            throw new Error(`Invalid simple value: ${value}`);
          }
        }
        return value;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (value === Infinity) {
          return new opts.ParentType(mav, Infinity, parent, opts);
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
      // For simple children, this will be the encoded form of the child.
      // For complex children, this will be just the beginning (MT/AI/LEN)
      // and will be replaced in replaceLast.
      this.#encodedChildren.push(stream.toHere(offset));
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
    item: CBORcontainer, stream:
    DecodeStream
  ): unknown {
    if (this.children instanceof Tag) {
      const ret = this.children.contents;
      this.children.contents = child;
      return ret;
    }
    const last = this.children.length - 1;

    if (this.#encodedChildren) {
      this.#encodedChildren[last] = stream.toHere(item.offset);
    }
    const ret = this.children[last];
    this.children[last] = child;
    return ret;
  }

  /**
   * Converts the childen to the most appropriate form known.
   *
   * @returns Anything BUT a CBORcontainer.
   * @throws Invalid major type.  Only possible in testing.
   */
  public convert(): unknown {
    switch (this.mt) {
      case MT.ARRAY:
        return this.children;
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

        // Extra array elements are ignored in both branches.
        return pu.every(([k]) => typeof k === 'string') ?
          Object.fromEntries(pu) :
          new Map<unknown, unknown>(pu as unknown as [unknown, unknown][]);
      }
      case MT.BYTE_STRING: {
        return u8concat(this.children as Uint8Array[]);
      }
      case MT.UTF8_STRING:
        return (this.children as string[]).join('');
      case MT.TAG:
        return (this.children as Tag).decode(this.#opts);
    }
    throw new TypeError(`Invalid mt on convert: ${this.mt}`);
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
