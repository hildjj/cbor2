import {Tag} from './tag.js';
import {decode} from './decoder.js';

function assertNumber(contents: any): asserts contents is number {
  if (typeof contents !== 'number') {
    throw new Error('Expected number');
  }
}

function assertString(contents: any): asserts contents is string {
  if (typeof contents !== 'string') {
    throw new Error('Expected string');
  }
}

function assertU8(contents: any): asserts contents is Uint8Array {
  if (!(contents instanceof Uint8Array)) {
    throw new Error('Expected Uint8Array');
  }
}

Tag.registerType(0, tag => {
  assertString(tag.contents);
  return new Date(tag.contents);
});

Tag.registerType(1, tag => {
  assertNumber(tag.contents);
  return new Date(tag.contents * 1000);
});

function u8toBigInt(tag: Tag): bigint {
  assertU8(tag.contents);
  return tag.contents.reduce((t, v) => (t << 8n) | BigInt(v), 0n);
}
Tag.registerType(2, u8toBigInt);
Tag.registerType(3, (tag: Tag): bigint => -1n - u8toBigInt(tag));

// From https://developer.mozilla.org/en-US/docs/Glossary/Base64
// I hate these functions, but they're close enough and I don't care about
// these use cases enough to optimize.
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(
    binString,
    (m: string): number => m.codePointAt(0) as number
  );
}

//
// function bytesToBase64(bytes: Uint8Array): string {
//   const binString = Array.from(bytes, (x: number) => String.fromCodePoint(x))
//     .join('');
//   return btoa(binString);
// }

Tag.registerType(24, (tag: Tag): any => {
  assertU8(tag.contents);
  return decode(tag.contents);
});

Tag.registerType(32, (tag: Tag): URL => {
  assertString(tag.contents);
  return new URL(tag.contents);
});

Tag.registerType(34, (tag: Tag): Uint8Array => {
  assertString(tag.contents);
  return base64ToBytes(tag.contents);
});

Tag.registerType(55799, (tag: Tag): any => tag.contents);
