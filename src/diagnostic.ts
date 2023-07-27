/**
 * Diagnostic notation from CBOR-encoded data.
 *
 * @module
 */

import {CBORcontainer} from './container.js';
// eslint-disable-next-line sort-imports -- eslint bug
import {type DecodeOptions, DecodeStream} from './decodeStream.js';
import {MT, SYMS} from './constants.js';
import {u8toHex} from './utils.js';

const NOT_FOUND = Symbol('NOT_FOUND');

class DiagContainer extends CBORcontainer {
  public count = 0;
  public close = '';
  public quote = '"';

  public get emptyStream(): boolean {
    return (this.mt === MT.UTF8_STRING || this.mt === MT.BYTE_STRING) &&
      (this.count === 0);
  }
}

function sized(ai: number, value: number): string {
  let str = Object.is(value, -0) ? '-0' : String(value);
  if (ai >= 24) {
    str += '_';
    str += String(ai - 24);
  }
  return str;
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

  let parent: DiagContainer | undefined = undefined;
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
    ret = CBORcontainer.create(mt, ai, val, parent, DiagContainer);
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
        str += sized(ai, val as number);
        break;
      case MT.SIMPLE_FLOAT:
        if (val !== SYMS.BREAK) {
          str += sized(ai, val as number);
        }
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          str += '(_ ';
          ret.close = ')';
          ret.quote = "'";
        } else {
          str += "h'";
          str += u8toHex(val as Uint8Array);
          str += "'";
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          str += '(_ ';
          ret.close = ')';
        } else {
          str += JSON.stringify(val); // Surrounds w/quotes and escapes
        }
        break;
      case MT.ARRAY:
        str += '[';
        ret.close = ']';
        if (val === Infinity) {
          str += '_ ';
        }
        break;
      case MT.MAP:
        str += '{';
        ret.close = '}';
        if (val === Infinity) {
          str += '_ ';
        }
        break;
      case MT.TAG:
        str += sized(ai, val as number);
        str += '(';
        ret.close = ')';
        break;
    }
    if (ret === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 0;
      } else {
        throw new Error('Unexpected BREAK');
      }
    } else if (parent) {
      parent.count++;
      parent.left--;
    }

    if (ret instanceof DiagContainer) {
      parent = ret;
    }
    while (parent?.done) {
      if (parent.emptyStream) {
        str = str.slice(0, -3);
        str += `_${parent.quote}${parent.quote}`;
      } else if ((parent.mt === MT.MAP) && ((parent.count % 2) !== 0)) {
        throw new Error(`Odd streaming map size: ${parent.count}`);
      } else {
        str += parent.close;
      }

      parent = parent.parent as DiagContainer | undefined;
    }
  }

  return str;
}
