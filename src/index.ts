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
export type {DecodeStream, ValueGenerator} from './decodeStream.js';
export type {
  DecodeStreamOptions,
  DecodeOptions,
  DecodeValue,
  DS,
  EncodeOptions,
  MtAiValue,
  Parent,
  ParentConstructor,
  RequiredDecodeOptions,
  RequiredEncodeOptions,
  Tg,
  WriterOptions,
} from './options.js';
export {decode} from './decoder.js';
export {diagnose} from './diagnostic.js';
export {DONE, encode} from './encoder.js';
export {Tag} from './tag.js';
export type {DoneEncoding, Writer} from './writer.js';
export {unbox, getEncoded} from './box.js';
