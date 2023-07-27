/**
 * Diagnostic notation from CBOR-encoded data.
 *
 * @module
 */
import {type DecodeOptions, DecodeStream} from './decodeStream.js';
import {MT, SYMS} from './constants.js';
import {u8toHex} from './utils.js';

const NOT_FOUND = Symbol('NOT_FOUND');

class Parent {
  public mt: number;
  public ai: number;
  public left: number;
  public parent: Parent | undefined;
  public count = 0;
  public close = '';
  public quote = '"';

  public constructor(mt: number, ai: number, size: number, parent?: Parent) {
    this.mt = mt;
    this.ai = ai;
    this.left = size;
    this.parent = parent;
  }
}

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param opts Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function diagnose(
  src: Uint8Array | string,
  opts?: DecodeOptions
): string {
  const stream = (typeof src === 'string') ?
    new DecodeStream(src, {encoding: 'hex', ...opts}) :
    new DecodeStream(src, opts);

  let parent: Parent | undefined = undefined;
  let ret: any = NOT_FOUND;
  let str = '';

  // eslint-disable-next-line prefer-const
  for (let [mt, ai, val] of stream) {
    if (parent && (parent.count > 0) && (val !== SYMS.BREAK)) {
      if ((parent.mt === MT.MAP) && (parent.count % 2)) {
        str += ': ';
      } else {
        str += ', ';
      }
    }
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
      case MT.SIMPLE_FLOAT:
        ret = val;
        if (val !== SYMS.BREAK) {
          str += Object.is(val, -0) ? '-0' : String(val);
          if (ai >= 24) {
            str += '_';
            str += String(ai - 24);
          }
        }
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          ret = new Parent(mt, ai, val, parent);
          str += '(_ ';
          ret.close = ')';
          ret.quote = "'";
        } else {
          ret = val;
          str += "h'";
          str += u8toHex(val as Uint8Array);
          str += "'";
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          ret = new Parent(mt, ai, val, parent);
          str += '(_ ';
          ret.close = ')';
        } else {
          ret = val;
          str += JSON.stringify(val);
        }
        break;
      case MT.ARRAY:
        ret = new Parent(mt, ai, val as number, parent);
        str += '[';
        ret.close = ']';
        if (val === Infinity) {
          str += '_ ';
        }
        break;
      case MT.MAP:
        ret = new Parent(mt, ai, (val as number) * 2, parent);
        str += '{';
        ret.close = '}';
        if (val === Infinity) {
          str += '_ ';
        }
        break;
      case MT.TAG:
        ret = new Parent(mt, ai, 1, parent);
        str += val;
        str += '(';
        ret.close = ')';
        break;
    }
    if (parent) {
      if (ret === SYMS.BREAK) {
        if (parent.left === Infinity) {
          parent.left = 0;
        } else {
          throw new Error('Unexpected BREAK');
        }
      } else {
        parent.count++;
        parent.left--;
      }
    }
    if (ret instanceof Parent) {
      parent = ret;
    }
    while (parent?.left === 0) {
      if ((parent.mt === MT.UTF8_STRING || parent.mt === MT.BYTE_STRING) &&
          (parent.count === 0)) {
        str = str.slice(0, -3);
        str += `_${parent.quote}${parent.quote}`;
      } else {
        str += parent.close;
      }

      ({parent} = parent);
    }
  }

  return str;
}
