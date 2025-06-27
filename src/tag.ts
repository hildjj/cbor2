import type {
  Decodeable,
  ITag,
  RequiredCommentOptions,
  RequiredDecodeOptions,
  TagDecoder,
  TagDecoderMap,
  TagNumber,
} from './options.js';
import {ToCBOR} from './writer.js';

/**
 * A CBOR tagged value.
 * @see https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
 */
export class Tag implements ToCBOR, Decodeable, ITag {
  static #tags = new Map<TagNumber, TagDecoder>() as TagDecoderMap;
  public readonly tag: TagNumber;
  public contents: unknown;

  /**
   * A tag wrapped around another value.
   *
   * @param tag The tag number.
   * @param contents The value that follows the tag number.
   */
  public constructor(tag: TagNumber, contents: unknown = undefined) {
    this.tag = tag;
    this.contents = contents;
  }

  /**
   * When constructing the commented version of this tag, should the contents
   * be written as well?  If true, the comment function should output the
   * contents values itself (only used for tag 24 so far).
   *
   * @type {boolean}
   * @readonly
   */
  public get noChildren(): boolean {
    const decoder = Tag.#tags.get(this.tag);
    return Boolean(decoder?.noChildren);
  }

  /**
   * Register a decoder for a give tag number.
   *
   * @param tag The tag number.
   * @param decoder Decoder function.
   * @param description If provided, use this when commenting to add a type
   *   name in parens after the tag number.
   * @returns Old decoder for this tag, if there was one.
   */
  public static registerDecoder(
    tag: TagNumber,
    decoder: TagDecoder,
    description?: string
  ): TagDecoder | undefined {
    const old = Tag.#tags.get(tag);
    Tag.#tags.set(tag, decoder);
    if (old) {
      // Copy over old commenting attributes.
      if (!('comment' in decoder)) {
        decoder.comment = old.comment;
      }
      if (!('noChildren' in decoder)) {
        decoder.noChildren = old.noChildren;
      }
    }
    if (description && !decoder.comment) {
      decoder.comment = (): string => `(${description})`;
    }
    return old;
  }

  /**
   * Remove the encoder for this tag number.
   *
   * @param tag Tag number.
   * @returns Old decoder, if there was one.
   */
  public static clearDecoder(tag: TagNumber): TagDecoder | undefined {
    const old = Tag.#tags.get(tag);
    Tag.#tags.delete(tag);
    return old;
  }

  /**
   * Get the decoder for a given tag number.
   *
   * @param tag The tag number.
   * @returns The decoder function, if there is one.
   */
  public static getDecoder(tag: TagNumber): TagDecoder | undefined {
    return Tag.#tags.get(tag);
  }

  /**
   * Get all registered decoders clone of the map.
   */
  public static getAllDecoders(): ReadonlyMap<TagNumber, TagDecoder> {
    return new Map(Tag.#tags);
  }

  /**
   * Iterate over just the contents, so that the tag works more like an
   * array.  Yields One time, the contained value.
   */
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
    const decoder = options?.tags?.get(this.tag) ?? Tag.#tags.get(this.tag);
    if (decoder) {
      return decoder(this, options);
    }
    return this;
  }

  public comment(
    options: RequiredCommentOptions,
    depth: number
  ): string | undefined {
    const decoder = options?.tags?.get(this.tag) ?? Tag.#tags.get(this.tag);
    if (decoder?.comment) {
      return decoder.comment(this, options, depth);
    }
    return undefined;
  }

  public toCBOR(): [TagNumber, unknown] {
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
