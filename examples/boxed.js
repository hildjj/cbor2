import {comment, decode, encode, encodedNumber, getEncoded} from 'cbor2';
import {u8toHex} from 'cbor2/utils';

const eNum = encodedNumber(4, 'f32');
const buf = encode(eNum);
console.log('4 as f32:', u8toHex(buf)); // 0xfa40800000
const dNum = decode(buf, {boxed: true});
console.log('Decoded as boxed Number:', dNum);
console.log('Re-encoded using originalEncoding:', u8toHex(getEncoded(dNum)));
console.log('Ignoring originalEncoding:', u8toHex(encode(eNum, {ignoreOriginalEncoding: true}))); // 0x04
console.log('4 as preferred float:', u8toHex(encode(encodedNumber(4))));
console.log('From issue #30:\n', comment(encode(new Map([
  [encodedNumber(1), [encodedNumber(10.5), encodedNumber(-2.0)]],
  [encodedNumber(2.0), 'Hi there!'],
]))));
