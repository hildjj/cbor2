import type {DecodeOptions, Parent} from './options.js';
import {CBORcontainer} from './container.js';
import {DecodeStream} from './decodeStream.js';
import {SYMS} from './constants.js';

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param src CBOR bytes to decode.
 * @param options Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function decode<T = unknown>(
  src: Uint8Array | string,
  options: DecodeOptions = {}
): T {
  const opts = {...CBORcontainer.defaultDecodeOptions};
  if (options.dcbor) {
    Object.assign(opts, CBORcontainer.dcborDecodeOptions);
  } else if (options.cde) {
    Object.assign(opts, CBORcontainer.cdeDecodeOptions);
  }
  Object.assign(opts, options);

  if (Object.hasOwn(opts, 'rejectLongNumbers')) {
    throw new TypeError('rejectLongNumbers has changed to requirePreferred');
  }

  if (opts.boxed) {
    opts.saveOriginal = true;
  }
  const stream = new DecodeStream(src, opts);
  let parent: Parent | undefined = undefined;
  let ret: unknown = undefined;

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
      ret = parent.convert(stream);

      const p = parent.parent;
      p?.replaceLast(ret, parent, stream);
      parent = p;
    }
  }
  return ret as T;
}
