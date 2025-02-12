/**
 * These are all internal utility functions for cbor2.  They are only exported
 * so that the web playground can use them.
 *
 * NO API backward compatibility is promised for these functions.  They are
 * not a part of the public interface, and changes here will not affect the
 * semver status of a changeset.  Use at your own risk.
 * @module
 */

export const CBOR_RANGES = Symbol('CBOR_RANGES');
export type CborRange = [start: number, len: number, string?];
export type Range8Array = Uint8Array & {
  [CBOR_RANGES]?: CborRange[];
};

export function setRanges(u8: Range8Array, ranges: CborRange[]): void {
  Object.defineProperty(u8, CBOR_RANGES, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: ranges,
  });
}

export function getRanges(u8: Range8Array): CborRange[] | undefined {
  return u8[CBOR_RANGES];
}

export function hasRanges(u8: Range8Array): boolean {
  return getRanges(u8) !== undefined;
}

/**
 * Convert hex string to Uint8Array.
 *
 * @param str Hex string.
 * @returns Array with contents decoded as hex from str.
 */
export function hexToU8(str: string): Uint8Array {
  let len = Math.ceil(str.length / 2);
  const res = new Uint8Array(len);
  len--;
  for (let end = str.length, start = end - 2;
    end >= 0;
    end = start, start -= 2, len--
  ) {
    res[len] = parseInt(str.substring(start, end), 16);
  }

  return res;
}

/**
 * Convert a Uint8Array to a hex string.
 *
 * @param u8 Array to convert.
 * @returns Hex string.
 */
export function u8toHex(u8: Uint8Array): string {
  return u8.reduce((t, v) => t + v.toString(16).padStart(2, '0'), '');
}

/**
 * Concatenate multiple Uint8Arrays into a single buffer.
 *
 * @param u8s Zero or more arrays to concatenate.
 * @returns Combined array.
 */
export function u8concat(u8s: Range8Array[]): Range8Array {
  const sz = u8s.reduce((t, v) => t + v.length, 0);
  const ranged = u8s.some(v => hasRanges(v));
  const ranges: CborRange[] = [];
  const ret = new Uint8Array(sz);
  let len = 0;
  for (const u8 of u8s) {
    if (!(u8 instanceof Uint8Array)) {
      throw new TypeError(`Invalid array: ${u8}`);
    }
    ret.set(u8, len);
    if (ranged) {
      const rgs: CborRange[] = u8[CBOR_RANGES] ?? [[0, u8.length]];
      for (const r of rgs) {
        r[0] += len;
      }
      ranges.push(...rgs);
    }
    len += u8.length;
  }
  if (ranged) {
    setRanges(ret, ranges);
  }
  return ret;
}

/**
 * Convert from Base64 to bytes in an unexciting way.
 * From https://developer.mozilla.org/en-US/docs/Glossary/Base64
 * which goes through an intermediate string form.  Bleh.
 *
 * @param base64 Base64-encoded string.
 * @returns String decoded into bytes.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(
    binString,
    (m: string): number => m.codePointAt(0) as number
  );
}

const urlToNotUrl: {
  [key: string]: string;
} = {
  '-': '+',
  '_': '/',
};

/**
 * Decode Base64url string to bytes.
 *
 * @param base64url Base64url-encoded string.
 * @returns Bytes.
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  const s = base64url.replace(/[_-]/g, (m: string) => urlToNotUrl[m]);
  return base64ToBytes(s.padEnd(Math.ceil(s.length / 4) * 4, '='));
}

/**
 * Is the current system big-endian?  Tested for, rather than using a node
 * built-in.
 *
 * @returns True if system is big-endian.
 */
export function isBigEndian(): boolean {
  const array = new Uint8Array(4);
  const view = new Uint32Array(array.buffer);
  return !((view[0] = 1) & array[0]);
}

/**
 * Convert a string to a U+xxxx notation for debugging.
 *
 * @param str String to convert
 * @returns "U+0000 U+0001"
 */
export function stringToHex(str: string): string {
  let res = '';
  for (const c of str) {
    const cp = c
      .codePointAt(0)
      ?.toString(16)
      .padStart(4, '0');
    if (res) {
      res += ', ';
    }
    res += `U+${cp}`;
  }
  return res;
}
