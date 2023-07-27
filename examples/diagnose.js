import 'cbor2/types';
import {diagnose} from 'cbor2/diagnostic';
import {encode} from 'cbor2/encoder';

const buf = encode(new Map([
  ['foo', Infinity],
  [{a: false}, [25, -60, 65536]],
]));
console.log(diagnose(buf));
