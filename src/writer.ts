import type {RequiredWriterOptions, WriterOptions} from './options.js';

// Don't inherit from stream.Writable, so it's more portable.
export class Writer {
  public static defaultOptions: RequiredWriterOptions = {
    chunkSize: 4096,
  };

  #opts: RequiredWriterOptions;
  #chunks: Uint8Array[] = [];
  #dv: DataView | null = null; // View over last chunk.
  #offset = 0;
  #length = 0;

  public constructor(opts: WriterOptions = {}) {
    this.#opts = {
      ...Writer.defaultOptions,
      ...opts,
    };
    if (this.#opts.chunkSize < 8) {
      throw new RangeError(`Expected size >= 8, got ${this.#opts.chunkSize}`);
    }
    this.#alloc();
  }

  public get length(): number {
    return this.#length;
  }

  public read(): Uint8Array {
    this.#trim();
    const ret = new Uint8Array(this.#length);
    let len = 0;
    for (const u8 of this.#chunks) {
      ret.set(u8, len);
      len += u8.length;
    }
    this.#alloc(); // Allow writes after reads
    return ret;
  }

  public write(buf: Uint8Array): void {
    const len = buf.length;
    if (len > this.#left()) {
      this.#trim();
      if (len > this.#opts.chunkSize) {
        // Won't fit, just re-use the existing buffer.
        // Note: if input buffer gets reused in the caller, copy buf here.
        this.#chunks.push(buf);
        this.#alloc(); // Leave an empty buffer at the end
      } else {
        this.#alloc();
        this.#chunks[this.#chunks.length - 1].set(buf);
        this.#offset = len;
      }
    } else {
      // There is room left in the existing chunk
      this.#chunks[this.#chunks.length - 1].set(buf, this.#offset);
      this.#offset += len;
    }
    this.#length += len;
  }

  public writeUint8(n: number): void {
    this.#makeSpace(1);
    (this.#dv as DataView).setUint8(this.#offset, n);
    this.#advance(1);
  }

  public writeUint16(n: number, littleEndian = false): void {
    this.#makeSpace(2);
    (this.#dv as DataView).setUint16(this.#offset, n, littleEndian);
    this.#advance(2);
  }

  public writeUint32(n: number, littleEndian = false): void {
    this.#makeSpace(4);
    (this.#dv as DataView).setUint32(this.#offset, n, littleEndian);
    this.#advance(4);
  }

  public writeBigUint64(n: bigint, littleEndian = false): void {
    this.#makeSpace(8);
    (this.#dv as DataView).setBigUint64(this.#offset, n, littleEndian);
    this.#advance(8);
  }

  public writeInt16(n: number, littleEndian = false): void {
    this.#makeSpace(2);
    (this.#dv as DataView).setInt16(this.#offset, n, littleEndian);
    this.#advance(2);
  }

  public writeInt32(n: number, littleEndian = false): void {
    this.#makeSpace(4);
    (this.#dv as DataView).setInt32(this.#offset, n, littleEndian);
    this.#advance(4);
  }

  public writeBigInt64(n: bigint, littleEndian = false): void {
    this.#makeSpace(8);
    (this.#dv as DataView).setBigInt64(this.#offset, n, littleEndian);
    this.#advance(8);
  }

  public writeFloat32(n: number, littleEndian = false): void {
    this.#makeSpace(4);
    (this.#dv as DataView).setFloat32(this.#offset, n, littleEndian);
    this.#advance(4);
  }

  public writeFloat64(n: number, littleEndian = false): void {
    this.#makeSpace(8);
    (this.#dv as DataView).setFloat64(this.#offset, n, littleEndian);
    this.#advance(8);
  }

  public clear(): void {
    this.#length = 0;
    this.#chunks = [];
    this.#alloc();
  }

  #alloc(): void {
    const buf = new Uint8Array(this.#opts.chunkSize);
    this.#chunks.push(buf);
    this.#offset = 0;
    this.#dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  // Always push a new chunk right after trimming.
  #trim(): void {
    if (this.#offset === 0) {
      this.#chunks.pop(); // TODO: save until next #alloc?
      return;
    }
    const last = this.#chunks.length - 1;
    this.#chunks[last] = this.#chunks[last].subarray(0, this.#offset);
    this.#offset = 0;
    this.#dv = null;
  }

  #left(): number {
    const last = this.#chunks.length - 1;
    return this.#chunks[last].length - this.#offset;
  }

  #makeSpace(sz: number): void {
    if (this.#left() < sz) {
      this.#trim();
      this.#alloc();
    }
  }

  #advance(sz: number): void {
    this.#offset += sz;
    this.#length += sz;
  }
}
