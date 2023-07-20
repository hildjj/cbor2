/**
 * Convert hex string to Uint8Array.
 *
 * @param str Hex string.
 * @returns Array with contents decoded as hex from str.
 */
export function hexToU8(str: string): Uint8Array {
  const len = str.length / 2;
  const res = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    res[i] = parseInt(str.substr(i << 1, 2), 16);
  }

  return res;
}
