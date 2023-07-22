
// eslint-disable-next-line no-use-before-define
export type TagConverter = (tag: Tag) => unknown;

export class Tag {
  static #tags = new Map<number, TagConverter>();
  public readonly tag: number;
  public contents: unknown;

  public constructor(tag: number, contents: unknown = undefined) {
    this.tag = tag;
    this.contents = contents;
  }

  public static registerType(
    tag: number, converter: TagConverter
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

  public convert(): unknown {
    const converter = Tag.#tags.get(this.tag);
    if (converter) {
      return converter(this);
    }
    return this;
  }

  public [Symbol.for('nodejs.util.inspect.custom')](
    depth: number,
    inspectOptions: object,
    inspect: (val: any, opts: object) => any
  ): string {
    return `${this.tag}(${inspect(this.contents, inspectOptions)})`;
  }
}
