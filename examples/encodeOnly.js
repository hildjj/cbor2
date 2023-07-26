import 'cbor2/types';
import {encode, registerEncoder} from 'cbor2/encoder';

class Bar {
  constructor() {
    this.today = new Date();
  }
}
registerEncoder(Bar, b => [9999, b.today]);

console.log(encode(new Bar()));
