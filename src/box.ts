import {SYMS} from './constants.js';
import {Tag} from './tag.js';

export interface OriginalEncoding {
  [SYMS.ENCODED]?: Uint8Array;
}
export interface ValueOf<T> extends OriginalEncoding {
  valueOf(): T;
}

/**
 * Get the encoded version of the object, if it has been stored on the object.
 *
 * @param obj Object to check.
 * @returns Encoded version as bytes, if available.
 */
export function getEncoded(obj: unknown): Uint8Array | undefined {
  if (obj && typeof obj === 'object') {
    return (obj as OriginalEncoding)[SYMS.ENCODED];
  }
  return undefined;
}

/**
 * Save the original encoding of the given object on the oject as a property
 * with a Symbol name, so it can be later extracted for round-tripping or
 * crypto.
 *
 * @param obj Object to tag.
 * @param orig Originally-encoded version of the object.
 */
export function saveEncoded(obj: OriginalEncoding, orig: Uint8Array): void {
  Object.defineProperty(obj, SYMS.ENCODED, {
    configurable: true,
    enumerable: false,
    value: orig,
  });
}

/**
 * Put an object wrapper around a primitive value, such as a number, boolean,
 * or bigint, storing the original CBOR encoding of the value for later
 * reconstitution.
 *
 * @param value Primitive value.
 * @param orig Original encoding.
 * @returns Object wrapper with toCBOR() method.
 */
export function box<T>(value: T, orig: Uint8Array): ValueOf<T> {
  const o = Object(value);
  saveEncoded(o, orig);
  return o;
}

/**
 * Remove all boxed types from an object.
 *
 * @param obj Object ot unbox.
 * @returns Unboxed copy.
 */
export function unbox(obj: unknown): unknown {
  if (!obj || (typeof obj !== 'object')) {
    return obj;
  }

  switch (obj.constructor) {
    case BigInt:
    case Boolean:
    case Number:
    case String:
      return obj.valueOf();
    case Array:
      return (obj as object[]).map(x => unbox(x));
    case Map: {
      const entries = [...(obj as Map<object, object>).entries()];
      return new Map(entries.map(([k, v]) => [unbox(k), unbox(v)]));
    }
    case Tag:
      return new Tag(
        unbox((obj as Tag).tag) as number,
        unbox((obj as Tag).contents)
      );
    case Object: {
      const ret: {
        [key: string]: unknown;
      } = {};
      for (const [k, v] of Object.entries(obj)) {
        ret[k] = unbox(v);
      }
      return ret;
    }
  }

  // Leave it alone.  We'll do more harm than good.
  return obj;
}
