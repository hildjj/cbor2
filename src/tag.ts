import {type RequiredEncodeOptions, writeTag, writeUnknown} from './encoder.js';
import type {Writer} from './writer.js';

export type TagConverter = (tag: Tag) => unknown;

/**
 * A CBOR tagged value.
 */
export class Tag {
  static #tags = new Map<bigint | number, TagConverter>();
  public readonly tag: number;
  public contents: unknown;

  public constructor(tag: number, contents: unknown = undefined) {
    this.tag = tag;
    this.contents = contents;
  }

  public static registerType(
    tag: bigint | number, converter: TagConverter
  ): TagConverter | undefined {
    const old = this.#tags.get(tag);
    this.#tags.set(tag, converter);
    return old;
  }

  public static clearType(tag: number): TagConverter | undefined {
    const old = this.#tags.get(tag);
    this.#tags.delete(tag);
    return old;
  }

  /**
   * Makes Tag act like an array, so that no special casing is needed when
   * the tag's contents are available.
   *
   * @param contents The value associated with the tag.
   * @returns Always returns 1.
   */
  public push(contents: unknown): number {
    this.contents = contents;
    return 1;
  }

  /**
   * Here to make Tag look more like an Array for TS.  Not useful.
   *
   * @returns Contents.
   */
  public pop(): unknown {
    return this.contents;
  }

  /**
   * Convert this tagged value to a useful data type, if possible.
   *
   * @returns The converted value.
   */
  public convert(): unknown {
    const converter = Tag.#tags.get(this.tag);
    if (converter) {
      return converter(this);
    }
    return this;
  }

  public toCBOR(w: Writer, opts: RequiredEncodeOptions): void {
    writeTag(w, this.tag);
    writeUnknown(w, this.contents, opts);
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    depth: number,
    inspectOptions: object,
    inspect: (val: any, opts: object) => any
  ): string {
    return `${this.tag}(${inspect(this.contents, inspectOptions)})`;
  }
}
