import type {ToCBOR, Writer} from './writer.js';

// 1, 5, 10
const F16_SIGN = 1n << 15n;
const F16_EXPONENT = 0b11111n << 10n;
const F16_QUIET = 1n << 9n;
const F16_PAYLOAD = F16_QUIET - 1n;
const F16_SIGNIFICAND = F16_QUIET | F16_PAYLOAD;

// 1, 8, 23
const F32_SIGN = 1n << 31n;
const F32_EXPONENT = 0b11111111n << 23n;
const F32_QUIET = 1n << 22n;
const F32_PAYLOAD = F32_QUIET - 1n;
const F32_SIGNIFICAND = F32_QUIET | F32_PAYLOAD;

// 1, 11, 52
const F64_SIGN = 1n << 63n;
const F64_EXPONENT = 0b11111111111n << 52n;
const F64_QUIET = 1n << 51n;
const F64_PAYLOAD = F64_QUIET - 1n;
const F64_SIGNIFICAND = F64_QUIET | F64_PAYLOAD;

// If any of these bits are set, this won't fit in an f16.
const NOT_F16 = F64_PAYLOAD - (F16_PAYLOAD << 42n);
const NOT_F32 = F64_PAYLOAD - (F32_PAYLOAD << 29n);

const RADIX_PREFIX: {
  [key: number]: string;
} = {
  2: '0b',
  8: '0o',
  16: '0x',
};

export enum NAN_SIZE {
  /** Only used for bigint constructor, means use the size of the bigint. */
  NATURAL = -2,

  /** Size not known, use the preferred size. */
  UNKNOWN = -1,
  F16 = 2,
  F32 = 4,
  F64 = 8,
}

function formatNAN(
  nan: NAN,
  _depth: number,
  inspectOptions: object,
  inspect: (val: unknown, opts: object) => unknown
): string {
  let ret = "nan'";
  if (!nan.quiet) {
    ret += '!';
  }
  if (nan.sign === -1) {
    ret += '-';
  }
  ret += inspect(Math.abs(nan.payload), inspectOptions);
  ret += "'";
  ret += nan.encodingIndicator;
  return ret;
}

/**
 * Wrapper for NaN with payload.  Note: the CBOR data model is always f64.
 * All of the size mechanics here are ONLY for getting EDN encoding indicators
 * correct.
 */
export class NAN extends Number implements ToCBOR {
  // Full f64 as unsigned.
  #value: bigint;
  #size = NAN_SIZE.UNKNOWN;

  /**
   * Create a boxed NaN.
   *
   * @param bytes Full CBOR encoding of the NaN, including leading MT/AI byte.
   */
  public constructor(bytes: Uint8Array);

  /**
   * Create a boxed NaN from constituent parts.
   *
   * @param payload Integer with absolute value < 2**52 - 1.  If negative,
   *   sign will be promoted to the float, and the absolute value will be used
   *   as the payload.
   * @param quiet True if quiet.
   * @param size Encoded size of the resulting CBOR bytes, as from encoding
   *   indicator. 1 = 3 bytes, 2 = 5 bytes, 3 = 9 bytes.  -1 (the default)
   *   means to use the payload to pick the minimum size.
   */
  public constructor(
    payload: number,
    quiet?: boolean,
    size?: NAN_SIZE
  );

  /**
   * Create a boxed NaN from a raw integer equivalent.
   *
   * @param raw Raw integer, such as 0x7e00n.  Can be 16-, 32- or 64-bits wide,
   *   but the exponent bits must be set correctly.
   * @param ignored This parameter is ignored in bigint mode.
   * @param size Use NAN_SIZE.NATURAL to copy the bigint size.
   */
  public constructor(
    raw: bigint,
    ignored?: boolean,
    size?: NAN_SIZE
  );
  public constructor(
    bytes: Uint8Array | number | bigint,
    quiet = true,
    size = NAN_SIZE.UNKNOWN
  ) {
    super(NaN);
    const orig = bytes;
    if (typeof bytes === 'number') {
      if (!Number.isSafeInteger(bytes)) {
        throw new Error(`Invalid NAN payload: ${bytes}`);
      }
      bytes = BigInt(bytes);

      let s = 0n;
      if (bytes < 0) {
        s = F64_SIGN;
        bytes = -bytes;
      }
      if (bytes >= F64_QUIET) {
        throw new Error(`Payload too large: ${orig}`);
      }
      const q = quiet ? F64_QUIET : 0n;
      this.#value = s | F64_EXPONENT | q | bytes;

      switch (size) {
        case NAN_SIZE.NATURAL:
          throw new Error('NAN_SIZE.NATURAL only valid for bigint constructor');
        case NAN_SIZE.UNKNOWN:
          size = this.preferredSize;
          break;
        case NAN_SIZE.F16:
          if (this.#value & NOT_F16) {
            throw new Error('Invalid size for payload');
          }
          break;
        case NAN_SIZE.F32:
          if (this.#value & NOT_F32) {
            throw new Error('Invalid size for payload');
          }
          break;
        case NAN_SIZE.F64:
          break;
        default:
          throw new Error(`Invalid size: ${size}`);
      }
      this.#size = size;
    } else if (typeof bytes === 'bigint') {
      let nat = NAN_SIZE.UNKNOWN;
      if ((bytes & F64_EXPONENT) === F64_EXPONENT) {
        this.#value = bytes;
        nat = NAN_SIZE.F64;
      } else if ((bytes & F32_EXPONENT) === F32_EXPONENT) {
        const s = (bytes & F32_SIGN) << 32n;
        this.#value = s | F64_EXPONENT | ((bytes & F32_SIGNIFICAND) << 29n);
        nat = NAN_SIZE.F32;
      } else if ((bytes & F16_EXPONENT) === F16_EXPONENT) {
        const s = (bytes & F16_SIGN) << 48n;
        this.#value = s | F64_EXPONENT | ((bytes & F16_SIGNIFICAND) << 42n);
        nat = NAN_SIZE.F16;
      } else {
        throw new Error(`Invalid raw NaN value: ${bytes}`);
      }
      if (size === NAN_SIZE.UNKNOWN) {
        this.#size = this.preferredSize;
      } else if (size === NAN_SIZE.NATURAL) {
        this.#size = nat;
      } else {
        if (size < nat) {
          throw new Error('Invalid bigint NaN size');
        }
        this.#size = size;
      }
    } else {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      switch (bytes.length) {
        case 3: {
          if (bytes[0] !== 0xf9) {
            throw new Error('Invalid CBOR encoding for half float');
          }
          const val = BigInt(dv.getUint16(1, false));
          if ((val & F16_EXPONENT) !== F16_EXPONENT) {
            throw new Error('Not a NaN');
          }
          const s = (val & F16_SIGN) << 48n;
          this.#value = s | F64_EXPONENT | ((val & F16_SIGNIFICAND) << 42n);
          this.#size = NAN_SIZE.F16;
          break;
        }
        case 5: {
          if (bytes[0] !== 0xfa) {
            throw new Error('Invalid CBOR encoding for single float');
          }
          const val = BigInt(dv.getUint32(1, false));
          if ((val & F32_EXPONENT) !== F32_EXPONENT) {
            throw new Error('Not a NaN');
          }
          const s = (val & F32_SIGN) << 32n;
          this.#value = s | F64_EXPONENT | ((val & F32_SIGNIFICAND) << 29n);
          this.#size = NAN_SIZE.F32;
          break;
        }
        case 9: {
          if (bytes[0] !== 0xfb) {
            throw new Error('Invalid CBOR encoding for double float');
          }
          this.#value = dv.getBigUint64(1, false);
          if ((this.#value & F64_EXPONENT) !== F64_EXPONENT) {
            throw new Error('Not a NaN (NaNaN)');
          }
          this.#size = NAN_SIZE.F64;
          break;
        }
        default:
          throw new RangeError(`Invalid NAN size (should be 2, 4, or 8): ${bytes.length - 1}`);
      }
    }
    if (!this.payload && !this.quiet) {
      throw new Error('Signalling NaN with zero payload');
    }
  }

  /**
   * Get the CBOR bytes for this NaN.
   */
  public get bytes(): Uint8Array {
    const buf = new ArrayBuffer(this.#size + 1);
    const dv = new DataView(buf);
    switch (this.#size) {
      case NAN_SIZE.F16: {
        dv.setUint8(0, 0xf9);
        const s = (this.#value & F64_SIGN) ? F16_SIGN : 0n;
        const val = s | F16_EXPONENT | ((this.#value & F64_SIGNIFICAND) >> 42n);
        dv.setUint16(1, Number(val), false);
        break;
      }
      case NAN_SIZE.F32: {
        dv.setUint8(0, 0xfa);
        const s = (this.#value & F64_SIGN) ? F32_SIGN : 0n;
        const val = s | F32_EXPONENT | ((this.#value & F64_SIGNIFICAND) >> 29n);
        dv.setUint32(1, Number(val), false);
        break;
      }
      case NAN_SIZE.F64:
        dv.setUint8(0, 0xfb);
        dv.setBigUint64(1, this.#value);
        break;
    }
    return new Uint8Array(buf);
  }

  /**
   * Is the quiet bit set?
   */
  public get quiet(): boolean {
    return Boolean(this.#value & F64_QUIET);
  }

  /**
   * If negative -1, otherwise 1.  Should never be 0, since you should use
   * a real NaN or Infinity for those.
   */
  public get sign(): number {
    return (this.#value & F64_SIGN) ? -1 : 1;
  }

  /**
   * Payload, as in IEEE754-2019.
   */
  public get payload(): number {
    return Number(this.#value & F64_PAYLOAD) * this.sign;
  }

  /**
   * Full 64-bit encoding, with sign and quiet bit intact.
   */
  public get raw(): bigint {
    return this.#value;
  }

  /**
   * Encoding indicator, based on the preferred size.
   */
  public get encodingIndicator(): string {
    switch (this.#size) {
      case NAN_SIZE.F16:
        return '_1';
      case NAN_SIZE.F32:
        return '_2';
    }
    return '_3';
  }

  /**
   * The desired encoding size (2, 4, or 8).
   */
  public get size(): NAN_SIZE {
    return this.#size;
  }

  /**
   * How many bytes should this NaN be encoded as in prefrerred encoding?
   */
  public get preferredSize(): NAN_SIZE {
    if ((this.#value & NOT_F16) === 0n) {
      return NAN_SIZE.F16;
    }
    if ((this.#value & NOT_F32) === 0n) {
      return NAN_SIZE.F32;
    }
    return NAN_SIZE.F64;
  }

  /**
   * Is this currrently configured for preferred encoding?
   */
  public get isShortestEncoding(): boolean {
    return this.preferredSize === this.#size;
  }

  /**
   * Write to a CBOR stream.
   * @param w Writer.
   */
  public toCBOR(w: Writer): undefined {
    w.write(this.bytes);
  }

  /**
   * Convert to a string in the given radix.
   *
   * @param radix Base for output.  Valid values: 2, 8, 10, and 16.
   * @returns String in the selected radix, with the correct radix prefix if
   *   radix is not 10.
   */
  public toString(radix = 10): string {
    return formatNAN(
      this,
      1,
      {},
      n => (RADIX_PREFIX[radix] ?? '') + (n as number).toString(radix)
    );
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    depth: number,
    inspectOptions: object,
    inspect: (val: unknown, opts: object) => unknown
  ): string {
    return formatNAN(this, depth, inspectOptions, inspect);
  }
}

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
