import {MT, SIMPLE} from './constants.js';
import type {ToCBOR, Writer} from './writer.js';
import type {RequiredEncodeOptions} from './options.js';
import {writeInt} from './encoder.js';

export type SimpleValue = true | false | null | undefined | Simple;

/**
 * A CBOR "Simple" value that is not one of the pre-standardized set.
 */
export class Simple implements ToCBOR {
  public static KnownSimple = new Map<number, SimpleValue>([
    [SIMPLE.FALSE, false],
    [SIMPLE.TRUE, true],
    [SIMPLE.NULL, null],
    [SIMPLE.UNDEFINED, undefined],
  ]);

  public value: number;

  public constructor(value: number) {
    this.value = value;
  }

  public static create(num: number): SimpleValue {
    if (!Simple.KnownSimple.has(num)) {
      return new Simple(num);
    }
    return Simple.KnownSimple.get(num);
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

  /**
   * Convert this simple value to a useful data type, if possible.
   *
   * @returns The converted value.
   */
  public decode(): SimpleValue {
    if (!Simple.KnownSimple.has(this.value)) {
      return this;
    }
    return Simple.KnownSimple.get(this.value);
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    _depth: number,
    inspectOptions: object,
    inspect: (val: unknown, opts: object) => unknown
  ): string {
    return `simple(${inspect(this.value, inspectOptions)})`;
  }
}
