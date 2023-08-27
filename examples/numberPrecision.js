import {decode, encode, getEncoded} from 'cbor2';
import {u8toHex} from 'cbor2/utils';

const v = decode('fb4000000000000000', {boxed: true});
console.log(v, typeof v); // [Number: 2] object
console.log(v + 3); // Arithmetic still works.  5.
console.log('Original: ', u8toHex(getEncoded(v))); // Original: fb4000000000000000
console.log('Re-encoded:', u8toHex(encode(v))); // Round-trip: fb4000000000000000
console.log('Re-encoded, ignore original:',
  u8toHex(encode(v, {ignoreOriginalEncoding: true})));

const b = decode('c243000000', {boxed: true});
console.log(b, typeof b);
console.log(u8toHex(encode(b)));
console.log(b + 3n);

// Equality doesn't work like you want, though:
console.log(v === 2); // False
console.log(b === 2n); // False
