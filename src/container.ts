import {DecodeStream, type DecodeStreamOptions, type MtAiValue} from './decodeStream.js';
import {CBORnumber} from './number.js';
import {MT} from './constants.js';
import {Tag} from './tag.js';
import {u8concat} from './utils.js';

function *pairs(
  a: unknown[]
): Generator<[unknown, unknown], undefined, undefined> {
  const len = a.length;
  let i = 0;
  for (; i < len; i += 2) {
    yield [a[i], a[i + 1]];
  }
  if (i !== len) {
    throw new Error('Missing map value');
  }
}

export interface ContainerOptions extends DecodeStreamOptions {
  ParentType?: typeof CBORcontainer;
  boxed?: boolean;
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
  public static defaultOptions: Required<ContainerOptions> = {
    ...DecodeStream.defaultOptions,
    ParentType: CBORcontainer,
    boxed: false,
  };

  public parent: CBORcontainer | undefined;
  public mt: number;
  public ai: number;
  public left: number;
  public children: Tag | unknown[] = [];

  public constructor(
    mt: number,
    ai: number,
    left: number,
    parent: CBORcontainer | undefined
  ) {
    this.mt = mt;
    this.ai = ai;
    this.left = left;
    this.parent = parent;
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
   * @returns ParentType instance or value.
   * @throws Invalid major type, which should only occur from tests.
   */
  public static create(
    mav: MtAiValue,
    parent: CBORcontainer | undefined,
    opts: Required<ContainerOptions>
  ): unknown {
    const [mt, ai, value] = mav;
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
      case MT.SIMPLE_FLOAT:
        if (opts.boxed && (typeof value === 'number')) {
          return new CBORnumber(value, mt, ai);
        }
        return value;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (value === Infinity) {
          return new opts.ParentType(mt, ai, Infinity, parent);
        }
        return value;
      case MT.ARRAY:
        return new opts.ParentType(mt, ai, value as number, parent);
      case MT.MAP:
        return new opts.ParentType(mt, ai, (value as number) * 2, parent);
      case MT.TAG: {
        const ret = new opts.ParentType(mt, ai, 1, parent);
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
   * @returns Previous child value.
   */
  public replaceLast(child: unknown): unknown {
    if (this.children instanceof Tag) {
      const ret = this.children.contents;
      this.children.contents = child;
      return ret;
    }
    const last = this.children.length - 1;
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
        const cu = this.children as unknown[];
        return cu.every((v, i) => (i % 2) || (typeof v === 'string')) ?
          Object.fromEntries(pairs(cu)) :
          new Map<unknown, unknown>(pairs(cu));
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
