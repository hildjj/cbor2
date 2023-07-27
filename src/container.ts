import {MT} from './constants.js';

function *pairs(a: any[]): Generator<[any, any], undefined, undefined> {
  const len = a.length;
  let i = 0;
  for (; i < len; i += 2) {
    yield [a[i], a[i + 1]];
  }
  if (i !== len) {
    throw new Error('Missing map value');
  }
}

/**
 * A CBOR data item that can contain other items.  One of:
 *
 * - Array (streaming or concrete).
 * - Map (streaming or concrete).
 * - Tag (always one item).
 * - Streaming byte arrays or UTF8 arrays.
 */
export class CBORcontainer {
  public parent: CBORcontainer | undefined;
  public mt: number;
  public ai: number;
  public left: number;
  public children: unknown[] = [];

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

  public get empty(): boolean {
    return this.children.length === 0;
  }

  public get done(): boolean {
    return this.left === 0;
  }

  public static create(
    mt: number,
    ai: number,
    value: unknown,
    parent: CBORcontainer | undefined
  ): unknown {
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
      case MT.SIMPLE_FLOAT:
        return value;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (value === Infinity) {
          return new CBORcontainer(mt, ai, Infinity, parent);
        }
        return value;
      case MT.ARRAY:
        return new CBORcontainer(mt, ai, value as number, parent);
      case MT.MAP:
        return new CBORcontainer(mt, ai, (value as number) * 2, parent);
      case MT.TAG:
        return new CBORcontainer(mt, ai, 1, parent);
    }
    throw new TypeError(`Invalid major type: ${mt}`);
  }

  public push(child: unknown): number {
    this.children.push(child);
    return --this.left;
  }

  public convert(): unknown {

  }
}
