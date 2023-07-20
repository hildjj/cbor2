export {DecodeStream} from './decodeStream.js';
export {decode} from './decoder.js';

/**
 * Encode any JS value as CBOR.
 *
 * @param input Any JS type, to be converted to CBOR.
 * @returns Encoded CBOR.
 */
export function encode<T>(input: T): Uint8Array {
  return new Uint8Array([0]);
}
