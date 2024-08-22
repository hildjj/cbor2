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
import {CBORcontainer} from './container.js';
export type {DecodeStream, ValueGenerator} from './decodeStream.js';
export type {
  CommentOptions,
  Decodeable,
  DecodeOptions,
  DecodeStreamOptions,
  DecodeValue,
  EncodeOptions,
  MtAiValue,
  Parent,
  ParentConstructor,
  RequiredCommentOptions,
  RequiredDecodeOptions,
  RequiredEncodeOptions,
  Sliceable,
  WriterOptions,
} from './options.js';
export {DiagnosticSizes} from './options.js';
export {decode} from './decoder.js';
export {diagnose} from './diagnostic.js';
export {comment} from './comment.js';
export {
  cdeEncodeOptions,
  defaultEncodeOptions,
  dcborEncodeOptions,
  encode,
  encodedNumber,
} from './encoder.js';
export {Simple} from './simple.js';
export {Tag} from './tag.js';
export type {TagNumber, TaggedValue, ToCBOR, Writer} from './writer.js';
export {saveEncoded, saveEncodedLength, unbox, getEncoded} from './box.js';
export const {
  cdeDecodeOptions,
  dcborDecodeOptions,
  defaultDecodeOptions,
} = CBORcontainer;
