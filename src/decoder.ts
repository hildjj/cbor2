import {DecodeStream} from './decodeStream.js';

export class Decoder {
  static decode(src: Uint8Array) {
    const stream = new DecodeStream(src);

    for (const [mt, ai, val] of stream) {

    }
  }
}
