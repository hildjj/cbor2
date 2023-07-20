import {
  MT,
  SYMS,
} from './constants.js';
import {DecodeStream} from './decodeStream.js';

const NOT_FOUND = Symbol('NOT_FOUND');

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
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function decode<T = any>(src: Uint8Array | string): T {
  const stream = (typeof src === 'string') ?
    new DecodeStream(src, {encoding: 'hex'}) :
    new DecodeStream(src);
  let parent: any[] | undefined = undefined;
  let ret: any = NOT_FOUND;
  const parentMap = new WeakMap<any[], any[] | undefined>();
  const countMap = new WeakMap<any[], number>();
  const typeMap = new WeakMap<any[], number>();

  for (const [mt, ai, val] of stream) {
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
      case MT.SIMPLE_FLOAT:
        ret = val;
        break;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (isFinite(ai)) {
          ret = val;
        } else {
          ret = [];
          parentMap.set(ret, parent);
          countMap.set(ret, ai);
          typeMap.set(ret, mt);
        }
        break;
      case MT.ARRAY:
        ret = [];
        parentMap.set(ret, parent);
        countMap.set(ret, ai);
        typeMap.set(ret, mt);
        break;
      case MT.MAP:
        ret = [];
        parentMap.set(ret, parent);
        countMap.set(ret, ai * 2);
        typeMap.set(ret, mt);
        break;
    }
    if (parent) {
      let count = countMap.get(parent);
      if (count === undefined) {
        throw new Error('Assert: count not found');
      }
      if (ret === SYMS.BREAK) {
        if (isFinite(count)) {
          throw new Error('Unexpected BREAK');
        } else {
          count = 0;
          countMap.set(parent, 0);
        }
      } else {
        parent.push(ret);
        countMap.set(parent, --count);
      }
    }
    if (Array.isArray(ret)) {
      parent = ret;
    }
    while (parent && (countMap.get(parent) === 0)) {
      switch (typeMap.get(parent)) {
        case MT.ARRAY:
          ret = parent;
          break;
        case MT.MAP:
          // Are all of the keys strings?
          ret = parent.every((v, i) => (i % 2) || (typeof v === 'string')) ?
            Object.fromEntries(pairs(parent)) :
            new Map<any, any>(pairs(parent));
          break;
        case MT.BYTE_STRING: {
          const sz = (parent as Uint8Array[]).reduce((t, v) => t + v.length, 0);
          ret = new Uint8Array(sz);
          let len = 0;
          for (const u8 of (parent as Uint8Array[])) {
            ret.set(u8, len);
            len += u8.length;
          }
          break;
        }
        case MT.UTF8_STRING:
          ret = (parent as string[]).join('');
          break;
      }
      const p = parentMap.get(parent);
      parentMap.delete(parent);
      countMap.delete(parent);
      typeMap.delete(parent);
      parent = p;
    }
  }
  return ret as T;
}
