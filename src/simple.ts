import type {ToCBOR, Writer} from './writer.js';
import {MT} from './constants.js';
import {RequiredEncodeOptions} from './options.js';
import {writeInt} from './encoder.js';

/**
 * A CBOR "Simple" value that is not one of the pre-standardized set.
 */
export class Simple implements ToCBOR {
  public value: number;

  public constructor(value: number) {
    this.value = value;
  }

  public toCBOR(w: Writer, opts: RequiredEncodeOptions): undefined {
    if (opts.rejectCustomSimples) {
      throw new Error(`Cannot encode non-standard Simple value: ${this.value}`);
    }
    writeInt(this.value, w, MT.SIMPLE_FLOAT);
  }

  public toString(): string {
    return `simple(${this.value})`;
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    _depth: number,
    inspectOptions: object,
    inspect: (val: unknown, opts: object) => unknown
  ): string {
    return `simple(${inspect(this.value, inspectOptions)})`;
  }
}
