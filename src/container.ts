import {DecodeStream, type DecodeStreamOptions, type MtAiValue} from './decodeStream.js';
import {MT, NUMBYTES} from './constants.js';
import {u8concat, u8toHex} from './utils.js';
import {CBORnumber} from './number.js';
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

function pairs(a: unknown[]): [key: unknown, value: unknown][] {
  const len = a.length;
  if (len % 2) {
    throw new Error('Missing map value');
  }
  const ret = new Array<[key: unknown, value: unknown]>(len / 2);
  for (let i = 0; i < len; i += 2) {
    ret[i >> 1] = [a[i], a[i + 1]];
  }
  return ret;
}

/**
 * Decoding options.
 */
export interface ContainerOptions extends DecodeStreamOptions {
  /**
   * What type to create when a container is needed?
   * @default CBORcontainer
   */
  ParentType?: typeof CBORcontainer;

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

export const dCBORdecodeOptions: ContainerOptions = {
  reject65bitNegative: true,
  rejectDuplicateKeys: true,
  rejectLongLoundNaN: true,
  rejectLongNumbers: true,
  rejectNegativeZero: true,
  rejectSimple: true,
  rejectStreaming: true,
};

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
  public static defaultOptions: Required<ContainerOptions> = {
    ...DecodeStream.defaultOptions,
    ParentType: CBORcontainer,
    boxed: false,
    reject65bitNegative: false,
    rejectDuplicateKeys: false,
    rejectLongLoundNaN: false,
    rejectLongNumbers: false,
    rejectNegativeZero: false,
    rejectSimple: false,
    rejectStreaming: false,
  };

  public parent: CBORcontainer | undefined;
  public mt: number;
  public ai: number;
  public left: number;
  public offset: number;
  public count = 0;
  public children: Tag | unknown[] = [];
  #opts: Required<ContainerOptions>;
  #dups: Set<string> | undefined;

  public constructor(
    mav: MtAiValue,
    left: number,
    parent: CBORcontainer | undefined,
    opts: Required<ContainerOptions>
  ) {
    [this.mt, this.ai, , this.offset] = mav;
    this.left = left;
    this.parent = parent;
    this.#opts = opts;

    if (this.#opts.rejectDuplicateKeys && (this.mt === MT.MAP)) {
      this.#dups = new Set<string>();
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
    parent: CBORcontainer | undefined,
    opts: Required<ContainerOptions>,
    stream: DecodeStream
  ): unknown {
    const [mt, ai, value, offset] = mav;
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
        if (opts.rejectLongNumbers && (ai > NUMBYTES.ZERO)) {
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
            const buf = encode(value, {chunkSize: 9});
            if ((buf[0] >> 5) !== mt) {
              throw new Error('Should have been encoded as int, not float');
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
   * @returns The number of items still needed.
   */
  public push(child: unknown): number {
    this.children.push(child);
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

    if (this.#dups && (last % 2 === 0)) {
      // This catches complex keys
      const hex = u8toHex(stream.toHere(item.offset));
      if (this.#dups.has(hex)) {
        throw new Error(`Duplicate key "${hex}"`);
      }
      this.#dups.add(hex);
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
        const pu = pairs(this.children as unknown[]);
        if (this.#opts.rejectDuplicateKeys) {
          // This catches all simple keys
          const ks = new Set<unknown>();
          for (const [k] of pu) {
            if (ks.has(k)) {
              throw new Error(`Duplicate key: "${String(k)}"`);
            }
            ks.add(k);
          }
        }
        return pu.every(([k]) => typeof k === 'string') ?
          Object.fromEntries(pu) :
          new Map<unknown, unknown>(pu);
      }
      case MT.BYTE_STRING: {
        return u8concat(this.children as Uint8Array[]);
      }
      case MT.UTF8_STRING:
        return (this.children as string[]).join('');
      case MT.TAG:
        return (this.children as Tag).decode();
    }
    throw new TypeError(`Invalid mt on convert: ${this.mt}`);
  }
}
