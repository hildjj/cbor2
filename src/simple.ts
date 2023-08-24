import type {DoneEncoding, Writer} from './writer.js';
import {MT, SYMS} from './constants.js';
import {RequiredEncodeOptions} from './options.js';
import {writeInt} from './encoder.js';

/**
 * A CBOR "Simple" value that is not one of the pre-standardized set.
 */
export class Simple {
  public value: number;

  public constructor(value: number) {
    this.value = value;
  }

  public toCBOR(w: Writer, opts: RequiredEncodeOptions): DoneEncoding {
    if (opts.rejectCustomSimples) {
      throw new Error(`Cannot encode non-standard Simple value: ${this.value}`);
    }
    writeInt(this.value, w, MT.SIMPLE_FLOAT);
    return SYMS.DONE;
  }

  public toString(): string {
    return `simple(${this.value})`;
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    depth: number,
    inspectOptions: object,
    inspect: (val: any, opts: object) => any
  ): string {
    return `simple(${inspect(this.value, inspectOptions)})`;
  }
}
