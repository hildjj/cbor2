import {decode} from 'cbor2/decoder';
import {encode} from 'cbor2/encoder';
import {u8toHex} from 'cbor2/utils';

const v = decode('fb4000000000000000', {boxed: true});
console.log(v, typeof v); // [Number (CBORnumber): 2] object
console.log(u8toHex(encode(v))); // Round-trip: fb4000000000000000
console.log(v + 3); // Arithmetic still works.  5.
