import {decode, encode} from 'cbor2';

const buf = encode(new Map([
  [1, 2],
  [3, false],
  [4, {a: 'b'}],
  [1.25, 0x1ffffffffffffffffn],
  [new Date(), new Int16Array([-1, 0, 1])],
]));
console.log(buf);
console.log(decode(buf));
