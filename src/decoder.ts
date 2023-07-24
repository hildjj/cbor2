import {type DecodeOptions, DecodeStream} from './decodeStream.js';
import {
  MT,
  SYMS,
} from './constants.js';
import {Tag} from './tag.js';

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

type Parent = any[] | Tag;

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param opts Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function decode<T = any>(
  src: Uint8Array | string,
  opts?: DecodeOptions
): T {
  const stream = (typeof src === 'string') ?
    new DecodeStream(src, {encoding: 'hex', ...opts}) :
    new DecodeStream(src, opts);
  let parent: Parent | undefined = undefined;
  let ret: any = NOT_FOUND;
  const parentMap = new WeakMap<Parent, Parent | undefined>();
  const countMap = new WeakMap<Parent, number>();
  const typeMap = new WeakMap<Parent, number>();

  for (const [mt, _ai, val] of stream) {
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
      case MT.SIMPLE_FLOAT:
        ret = val;
        break;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (val === Infinity) {
          ret = [];
          parentMap.set(ret, parent);
          countMap.set(ret, Infinity);
          typeMap.set(ret, mt);
        } else {
          ret = val;
        }
        break;
      case MT.ARRAY:
        ret = [];
        parentMap.set(ret, parent);
        countMap.set(ret, val as number);
        typeMap.set(ret, mt);
        break;
      case MT.MAP:
        ret = [];
        parentMap.set(ret, parent);
        countMap.set(ret, (val as number) * 2);
        typeMap.set(ret, mt);
        break;
      case MT.TAG:
        ret = new Tag(val as number);
        parentMap.set(ret, parent);
        countMap.set(ret, 1);
        typeMap.set(ret, mt);
        break;
    }
    if (parent) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let count = countMap.get(parent)!;
      if (ret === SYMS.BREAK) {
        if (count === Infinity) {
          count = 0;
          countMap.set(parent, 0);
        } else {
          throw new Error('Unexpected BREAK');
        }
      } else {
        parent.push(ret);
        countMap.set(parent, --count);
      }
    }
    if (Array.isArray(ret) || ret instanceof Tag) {
      parent = ret;
    }
    while (parent && (countMap.get(parent) === 0)) {
      switch (typeMap.get(parent)) {
        case MT.ARRAY:
          ret = parent;
          break;
        case MT.MAP:
          // Are all of the keys strings?
          // Note that __proto__ gets special handling as a key in fromEntries,
          // since it's doing DefineOwnProperty down inside.
          ret = (parent as any[]).every((v, i) => (i % 2) || (typeof v === 'string')) ?
            Object.fromEntries(pairs(parent as any[])) :
            new Map<any, any>(pairs(parent as any[]));
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
        case MT.TAG:
          ret = (parent as Tag).convert();
          break;
      }
      const p = parentMap.get(parent);
      p?.pop();
      p?.push(ret);
      parentMap.delete(parent);
      countMap.delete(parent);
      typeMap.delete(parent);
      parent = p;
    }
  }
  return ret as T;
}
