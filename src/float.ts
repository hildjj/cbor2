/**
 * Parse a big endian float16 from a buffer.
 *
 * @param buf Buffer to read from.
 * @param offset Offset into buf to start reading 2 octets.
 * @param rejectSubnormals Throw if the result is subnormal.
 * @returns Parsed float.
 * @throws Unwanted subnormal.
 */
export function parseHalf(
  buf: Uint8Array,
  offset = 0,
  rejectSubnormals = false
): number {
  const sign = buf[offset] & 0x80 ? -1 : 1;
  const exp = (buf[offset] & 0x7C) >> 2;
  const mant = ((buf[offset] & 0x03) << 8) | buf[offset + 1];
  if (exp === 0) {
    if (rejectSubnormals && (mant !== 0)) {
      throw new Error(`Unwanted subnormal: ${sign * 5.9604644775390625e-8 * mant}`);
    }
    return sign * 5.9604644775390625e-8 * mant;
  } else if (exp === 0x1f) {
    if (mant) {
      // Always simplify NaNs, since non-simple NaNs are different in different
      // JS engines.
      return NaN;
    }
    return sign * Infinity;
  }
  return sign * (2 ** (exp - 25)) * (1024 + mant);
}

/**
 * Return a big-endian unsigned integer that has the same internal layout
 * as the given number as a float16, if it fits.  Otherwise returns null.
 *
 * @param half The number to convert to a half-precision float.  Must fit into
 *   at least a float32.
 * @returns Number on success, otherwise null.  Make sure to check with
 *   `=== null`, in case this returns 0, which is valid.
 */
export function halfToUint(half: number): number | null {
  // Translation of cn-cbor's C code (from Carsten Borman):

  const dvu32 = new DataView(new ArrayBuffer(4));
  dvu32.setFloat32(0, half, false);
  const u = dvu32.getUint32(0, false);

  // If the lower 13 bits aren't 0,
  // we will lose precision in the conversion.
  // mant32 = 24bits, mant16 = 11bits, 24-11 = 13
  if ((u & 0x1FFF) !== 0) {
    return null;
  }

  let s16 = (u >> 16) & 0x8000; // Top bit is sign
  const exp = (u >> 23) & 0xff; // Then 8 bits of exponent
  const mant = u & 0x7fffff; // Then 23 bits of mantissa

  if ((exp === 0) && (mant === 0)) {
    // No-op.  Sign already in s16.  -0 or 0.
  } else if ((exp >= 113) && (exp <= 142)) {
    // Normal number.  Shift the exponent and mantissa to fit.
    s16 += ((exp - 112) << 10) + (mant >> 13);
  } else if ((exp >= 103) && (exp < 113)) {
    // Denormalized numbers.
    if (mant & ((1 << (126 - exp)) - 1)) {
      // Loses precision further.
      return null;
    }
    s16 += ((mant + 0x800000) >> (126 - exp));
  } else if (exp === 255) {
    // NaN and Infinities.
    s16 |= 0x7c00;
    s16 |= mant >> 13;
  } else {
    // Outside of half range.
    return null;
  }

  return s16;
}

/**
 * Flush subnormal numbers to 0/-0.
 *
 * @param n Number.
 * @returns Normalized number.
 */
export function flushToZero(n: number): number {
  if (n !== 0) { // Remember 0 === -0
    const a = new ArrayBuffer(8);
    const dv = new DataView(a);
    dv.setFloat64(0, n, false);
    const b = dv.getBigUint64(0, false);
    // Subnormals have an 11-bit exponent of 0 and a non-zero mantissa.
    if ((b & 0x7ff0000000000000n) === 0n) {
      return (b & 0x8000000000000000n) ? -0 : 0;
    }
  }
  return n;
}

/**
 * Does the given buffer contain a bigEndian IEEE754 float that is subnormal?
 * If so, throw an error.
 *
 * @param buf 2, 4, or 8 bytes for float16, float32, or float64.
 * @throws Bad input or subnormal.
 */
export function checkSubnormal(buf: Uint8Array): void {
  switch (buf.length) {
    case 2:
      parseHalf(buf, 0, true);
      break;
    case 4: {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const n = dv.getUint32(0, false);
      if (((n & 0x7f800000) === 0) && (n & 0x007fffff)) {
        throw new Error(`Unwanted subnormal: ${dv.getFloat32(0, false)}`);
      }
      break;
    }
    case 8: {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const n = dv.getBigUint64(0, false);
      if (((n & 0x7ff0000000000000n) === 0n) && (n & 0x000fffffffffffn)) {
        throw new Error(`Unwanted subnormal: ${dv.getFloat64(0, false)}`);
      }
      break;
    }
    default:
      throw new TypeError(`Bad input to isSubnormal: ${buf}`);
  }
}
