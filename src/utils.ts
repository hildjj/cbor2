/**
 * These are all internal utility functions for cbor2.  They are only exported
 * so that the web playground can use them.
 *
 * NO API backward compatibility is promised for these functions.  They are
 * not a part of the public interface, and changes here will not affect the
 * semver status of a changeset.  Use at your own risk.
 * @module
 */

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
export function u8concat(u8s: Uint8Array[]): Uint8Array {
  const sz = u8s.reduce((t, v) => t + v.length, 0);
  const ret = new Uint8Array(sz);
  let len = 0;
  for (const u8 of u8s) {
    ret.set(u8, len);
    len += u8.length;
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
