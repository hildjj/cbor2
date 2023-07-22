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

/**
 * Create a 2 byte Uint8Array from a number as a IEEE754 binary16, and write
 * it into the given DataView at the given offset.
 *
 * @param dv DataView to write into.
 * @param offset Where to start writing.
 * @param half The number to convert to a half-precision float.
 * @returns True on success.
 */
export function writeFloat16(
  dv: DataView, offset: number, half: number
): boolean {
  // HACK: everyone settle in.  This isn't going to be pretty.
  // Translate cn-cbor's C code (from Carsten Borman):

  // uint32_t be32;
  // uint16_t be16, u16;
  // union {
  //   float f;
  //   uint32_t u;
  // } u32;
  // u32.f = float_val;

  const u32 = new Uint8Array(4);
  const dvu32 = new DataView(u32.buffer, u32.byteOffset, u32.byteLength);
  dvu32.setFloat32(0, half, false);
  const u = dvu32.getUint32(0, false);

  // If ((u32.u & 0x1FFF) == 0) { /* worth trying half */

  // hildjj: If the lower 13 bits aren't 0,
  // we will lose precision in the conversion.
  // mant32 = 24bits, mant16 = 11bits, 24-11 = 13
  if ((u & 0x1FFF) !== 0) {
    return false;
  }

  // Sign, exponent, mantissa
  //   int s16 = (u32.u >> 16) & 0x8000;
  //   int exp = (u32.u >> 23) & 0xff;
  //   int mant = u32.u & 0x7fffff;

  let s16 = (u >> 16) & 0x8000; // Top bit is sign
  const exp = (u >> 23) & 0xff; // Then 8 bits of exponent
  const mant = u & 0x7fffff; // Then 23 bits of mantissa

  //
  //   if (exp == 0 && mant == 0)
  //     ;              /* 0.0, -0.0 */

  if ((exp === 0) && (mant === 0)) {
    // No-op
  } else if ((exp >= 113) && (exp <= 142)) {
    //
    //   else if (exp >= 113 && exp <= 142) /* normalized */
    //     s16 += ((exp - 112) << 10) + (mant >> 13);
    s16 += ((exp - 112) << 10) + (mant >> 13);
  } else if ((exp >= 103) && (exp < 113)) {
    // Denormalized numbers
    //   else if (exp >= 103 && exp < 113) { /* denorm, exp16 = 0 */
    //     if (mant & ((1 << (126 - exp)) - 1))
    //       goto float32;         /* loss of precision */
    //     s16 += ((mant + 0x800000) >> (126 - exp));

    if (mant & ((1 << (126 - exp)) - 1)) {
      return false;
    }
    s16 += ((mant + 0x800000) >> (126 - exp));
  } else if (exp === 255) {
    //   } else if (exp == 255 && mant == 0) { /* Inf */
    //     s16 += 0x7c00;
    if (mant === 0) { // +/- Infinity
      s16 += 0x7c00;
    } else { // NaN
      s16 = 0x7e00;
    }
  } else {
    //   } else
    //     goto float32;           /* loss of range */
    return false;
  }

  // Done
  //   ensure_writable(3);
  //   u16 = s16;
  //   be16 = hton16p((const uint8_t*)&u16);
  dv.setUint16(offset, s16, false);
  return true;
}
