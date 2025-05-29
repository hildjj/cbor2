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
export {version} from './version.js';
import {CBORcontainer} from './container.js';
export type {DecodeStream, ValueGenerator} from './decodeStream.js';
export type {
  BaseDecoder,
  CommentOptions,
  Decodeable,
  DecodeOptions,
  DecodeStreamOptions,
  DecodeValue,
  EncodeOptions,
  MtAiValue,
  ICommenter,
  ITag,
  ObjectCreator,
  Parent,
  ParentConstructor,
  RequiredCommentOptions,
  RequiredDecodeOptions,
  RequiredEncodeOptions,
  RequiredWriterOptions,
  Sliceable,
  StringNormalization,
  TagDecoder,
  TagDecoderMap,
  TagNumber,
  WriterOptions,
} from './options.js';
export {DiagnosticSizes} from './options.js';
export {decode, decodeSequence, SequenceEvents} from './decoder.js';
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
export {type ToCBOR, Writer} from './writer.js';
export {saveEncoded, saveEncodedLength, unbox, getEncoded, type OriginalEncoding} from './box.js';
export const {
  cdeDecodeOptions,
  dcborDecodeOptions,
  defaultDecodeOptions,
} = CBORcontainer;
export {
  type AbstractClassType,
  type TaggedValue,
  type TypeEncoder,
  TypeEncoderMap,
} from './typeEncoderMap.js';
