import type {RequiredEncodeOptions, TagNumber} from './options.js';
import type {Writer} from './writer.js';

/**
 * Any class.  Ish.
 */
export type AbstractClassType<T extends abstract new (...args: any) => any> =
  abstract new (...args: any) => InstanceType<T>;

/**
 * A potentially-tagged value.  If the tag is NaN, it will not be used.
 * Otherwise, it must be an integer that will be written as a CBOR tag
 * before the value is encoded.
 */
export type TaggedValue = [tag: TagNumber, value: unknown];

/**
 * Encode an object of the given type into a CBOR stream.  Return a
 * TaggedValue for automatic processing, which will write the tag (unless it
 * is a NaN), then the value.  If manual processing is desired, use the given
 * writer to put bytes in the outputs stream.
 */
export type TypeEncoder<T> = (
  obj: T,
  w: Writer,
  opts: RequiredEncodeOptions
) => TaggedValue | undefined;

/**
 * Contain a set of mappings from an object constructor to a matching
 * TypeEncoder.
 */
export class TypeEncoderMap {
  #types = new Map<AbstractClassType<any>, TypeEncoder<any>>();

  /**
   * Register an encoder for a given type.
   *
   * @param typ The class to encode.  This is the function for the constructor
   *   of objects of this type.  For example, Uint8Array the value of the
   *   constructor property of a Uint8Array instance.
   * @param encoder The function to use for encoding this type.
   * @returns Previous registration, or undefined if none.
   */
  public registerEncoder<T extends AbstractClassType<T>>(
    typ: T,
    encoder: TypeEncoder<InstanceType<T>>
  ): TypeEncoder<T> | undefined {
    const old = this.#types.get(typ);
    this.#types.set(typ, encoder);
    return old;
  }

  /**
   * Get the encoder for a given class.
   *
   * @param typ Constructor function.
   * @returns Encoder, or undefined if none specified.
   */
  public get<T extends AbstractClassType<T>>(
    typ: T
  ): TypeEncoder<InstanceType<T>> | undefined {
    return this.#types.get(typ);
  }

  /**
   * Delete the encoder for a given class.
   *
   * @param typ Constructor function.
   * @returns True if class found and deleted, otherwise false.
   */
  public delete<T extends AbstractClassType<T>>(typ: T): boolean {
    return this.#types.delete(typ);
  }

  /**
   * Remove all classes from the map.
   */
  public clear(): void {
    this.#types.clear();
  }
}
