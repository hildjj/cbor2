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

export type TypeEncoder<T> = (
  obj: T,
  w: Writer,
  opts: RequiredEncodeOptions
) => TaggedValue | undefined;

export class TypeEncoderMap {
  #types = new Map<AbstractClassType<any>, TypeEncoder<any>>();

  public registerEncoder<T extends AbstractClassType<T>>(
    typ: T,
    encoder: TypeEncoder<InstanceType<T>>
  ): TypeEncoder<T> | undefined {
    const old = this.#types.get(typ);
    this.#types.set(typ, encoder);
    return old;
  }

  public get<T extends AbstractClassType<T>>(
    typ: T
  ): TypeEncoder<InstanceType<T>> | undefined {
    return this.#types.get(typ);
  }

  public delete<T extends AbstractClassType<T>>(typ: T): boolean {
    return this.#types.delete(typ);
  }

  public clear(): void {
    this.#types.clear();
  }
}
