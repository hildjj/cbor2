import {CBORcontainer} from './container.js';
// eslint-disable-next-line sort-imports -- eslint bug
import {type DecodeOptions, DecodeStream} from './decodeStream.js';
import {SYMS} from './constants.js';

const NOT_FOUND = Symbol('NOT_FOUND');

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param opts Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function decode<T = unknown>(
  src: Uint8Array | string,
  opts?: DecodeOptions
): T {
  const stream = (typeof src === 'string') ?
    new DecodeStream(src, {encoding: 'hex', ...opts}) :
    new DecodeStream(src, opts);
  let parent: CBORcontainer | undefined = undefined;
  let ret: unknown = NOT_FOUND;

  // eslint-disable-next-line prefer-const
  for (let [mt, ai, val] of stream) {
    ret = CBORcontainer.create(mt, ai, val, parent);
    if (parent) {
      if (ret === SYMS.BREAK) {
        if (parent.isStreaming) {
          parent.left = 0;
        } else {
          throw new Error('Unexpected BREAK');
        }
      } else {
        parent.push(ret);
      }
    }
    if (ret instanceof CBORcontainer) {
      parent = ret;
    }
    while (parent?.left === 0) {
      ret = parent?.convert();

      const p = parent?.parent;
      p?.pop();
      p?.push(ret);
      parent = p;
    }
  }
  return ret as T;
}
