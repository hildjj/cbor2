import {MT} from './constants.js';
import type {Writer} from './writer.js';
import {writeInt} from './encoder.js';

/**
 * A CBOR "Simple" value that is not one of the pre-standardized set.
 */
export class Simple {
  public value: number;

  public constructor(value: number) {
    this.value = value;
  }

  public toCBOR(w: Writer, val: unknown): void {
    writeInt(w, this.value, MT.SIMPLE_FLOAT);
  }

  public toString(): string {
    return `Simple(${this.value})`;
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    depth: number,
    inspectOptions: object,
    inspect: (val: any, opts: object) => any
  ): string {
    return `Simple(${inspect(this.value, inspectOptions)})`;
  }
}
