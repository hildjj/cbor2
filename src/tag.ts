import type {Decodeable, RequiredDecodeOptions} from './options.js';
import {ToCBOR} from './writer.js';

export type TagDecoder = (tag: Tag, opts: RequiredDecodeOptions) => unknown;

/**
 * A CBOR tagged value.
 */
export class Tag implements ToCBOR, Decodeable {
  static #tags = new Map<bigint | number, TagDecoder>();
  public readonly tag: number;
  public contents: unknown;

  public constructor(tag: number, contents: unknown = undefined) {
    this.tag = tag;
    this.contents = contents;
  }

  public static registerDecoder(
    tag: bigint | number, decoder: TagDecoder
  ): TagDecoder | undefined {
    const old = this.#tags.get(tag);
    this.#tags.set(tag, decoder);
    return old;
  }

  public static clearDecoder(tag: number): TagDecoder | undefined {
    const old = this.#tags.get(tag);
    this.#tags.delete(tag);
    return old;
  }

  public *[Symbol.iterator](): Generator<unknown, void, undefined> {
    yield this.contents;
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
   * Convert this tagged value to a useful data type, if possible.
   *
   * @param options Options for decoding.
   * @returns The converted value.
   */
  public decode(options: RequiredDecodeOptions): unknown {
    const decoder = Tag.#tags.get(this.tag);
    if (decoder) {
      return decoder(this, options);
    }
    return this;
  }

  public toCBOR(): [number, unknown] {
    return [this.tag, this.contents];
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    _depth: number,
    inspectOptions: object,
    inspect: (val: unknown, opts: object) => unknown
  ): string {
    return `${this.tag}(${inspect(this.contents, inspectOptions)})`;
  }
}
