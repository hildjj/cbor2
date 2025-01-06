import 'cbor2/types';
import {encode, registerEncoder} from 'cbor2/encoder';
import {Buffer} from 'node:buffer';

class Bar {
  constructor() {
    this.today = new Date();
  }
}
registerEncoder(Bar, b => [9999, b.today]);
registerEncoder(Buffer, b => [
  // Don't write a tag
  NaN,
  // New view on the ArrayBuffer, without copying bytes
  new Uint8Array(b.buffer, b.byteOffset, b.byteLength),
]);

console.log(encode(new Bar()));

const buf1 = Buffer.from('0102030405060708090a', 'hex');
const buf2 = buf1.subarray(2, 8);
console.log(encode(buf2));
