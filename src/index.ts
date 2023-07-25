/**
 * Batteries-included easy entry point.  Pulls in all type encoders and
 * decoders.
 *
 * If you only need encoding *or* decoding, or if you don't want to use
 * tags in either direction, or if you just want more control, you might
 * want to import different modules directly.
 *
 * @module
 */

import './types.js';
export {DecodeStream} from './decodeStream.js';
export {decode} from './decoder.js';
export {encode} from './encoder.js';
