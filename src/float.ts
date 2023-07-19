/**
 * Parse a big endian float from a buffer.
 *
 * @param buf Buffer to read from.
 * @param offset Offset into buf to start reading 2 octets.
 * @returns Parsed float.
 */
export function parseHalf(buf: Uint8Array, offset = 0): number {
  const sign = buf[offset] & 0x80 ? -1 : 1;
  const exp = (buf[offset] & 0x7C) >> 2;
  const mant = ((buf[offset] & 0x03) << 8) | buf[offset + 1];
  if (!exp) {
    return sign * 5.9604644775390625e-8 * mant;
  } else if (exp === 0x1f) {
    return sign * (mant ? NaN : Infinity);
  }
  return sign * (2 ** (exp - 25)) * (1024 + mant);
}
