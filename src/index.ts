/**
 * Encode any JS value as CBOR.
 *
 * @param input Any JS type, to be converted to CBOR.
 * @returns Encoded CBOR.
 */
export function encode<T>(input: T): Uint8Array {
  return new Uint8Array([0]);
}

/**
 * Decode CBOR bytes to a JS value.
 *
 * @param buf CBOR bytes to decode.
 * @returns JS value decoded from cbor.
 */
export function decode<T = any>(buf: Uint8Array): T {
  return null as T;
}
