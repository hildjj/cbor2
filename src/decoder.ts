import {CBORcontainer, type ContainerOptions} from './container.js';
import {DecodeStream} from './decodeStream.js';
import {SYMS} from './constants.js';

export {dCBORdecodeOptions} from './container.js';

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param options Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function decode<T = unknown>(
  src: Uint8Array | string,
  options?: ContainerOptions
): T {
  const opts: Required<ContainerOptions> = {
    ...CBORcontainer.defaultOptions,
    ...options,
  };
  const stream = (typeof src === 'string') ?
    new DecodeStream(src, opts) :
    new DecodeStream(src, opts);
  let parent: CBORcontainer | undefined = undefined;
  let ret: unknown = SYMS.NOT_FOUND;

  for (const mav of stream) {
    ret = CBORcontainer.create(mav, parent, opts, stream);

    if (mav[2] === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 0;
      } else {
        throw new Error('Unexpected BREAK');
      }
    } else if (parent) {
      parent.push(ret, stream, mav[3]);
    }

    if (ret instanceof CBORcontainer) {
      parent = ret;
    }

    // Convert all finished parents in the chain to the correct type, replacing
    // in *their* parents as necessary.
    while (parent?.done) {
      ret = parent.convert();

      const p = parent.parent;
      p?.replaceLast(ret, parent, stream);
      parent = p;
    }
  }
  return ret as T;
}
