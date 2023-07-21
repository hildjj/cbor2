export class Simple {
  public value: number;

  public constructor(value: number) {
    this.value = value;
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
