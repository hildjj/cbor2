import {decode, encode, encodedNumber, getEncoded} from 'cbor2';

const eNum = encodedNumber(4, 'f32');
const buf = encode(eNum);
console.log(buf); // Hex: fa40800000
const dNum = decode(buf, {boxed: true});
console.log(dNum);
console.log(getEncoded(dNum));
console.log(encode(eNum, {ignoreOriginalEncoding: true})); // 0x04
