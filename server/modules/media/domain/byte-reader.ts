import { MetadataError } from './metadata-error'

/**
 * Reads a byte stream (an R2 body) without holding it: only headers and metadata blocks are buffered, image data is
 * passed through chunk by chunk. A source that ends early is malformed.
 */
export class ByteReader {
  private buf: Uint8Array = new Uint8Array(0)
  private readonly source: AsyncIterator<Uint8Array>

  constructor(source: AsyncIterable<Uint8Array>) {
    this.source = source[Symbol.asyncIterator]()
  }

  /** Unread buffered bytes. */
  get view(): Uint8Array {
    return this.buf
  }

  /** Buffers at least n bytes; false when the source ends first. */
  async fill(n: number): Promise<boolean> {
    while (this.buf.length < n) {
      const next = await this.source.next()
      if (next.done) return false
      if (this.buf.length === 0) {
        this.buf = next.value
        continue
      }
      const joined = new Uint8Array(this.buf.length + next.value.length)
      joined.set(this.buf)
      joined.set(next.value, this.buf.length)
      this.buf = joined
    }
    return true
  }

  /** The next n buffered bytes, consumed. */
  take(n: number): Uint8Array {
    const out = this.buf.subarray(0, n)
    this.buf = this.buf.subarray(n)
    return out
  }

  async read(n: number): Promise<Uint8Array> {
    if (!(await this.fill(n))) throw new MetadataError('malformed')
    return this.take(n)
  }

  /** Streams the next n bytes as they arrive. */
  async *pass(n: number): AsyncGenerator<Uint8Array> {
    while (n > 0) {
      if (!(await this.fill(1))) throw new MetadataError('malformed')
      const part = this.take(Math.min(n, this.buf.length))
      n -= part.length
      yield part
    }
  }

  async skip(n: number): Promise<void> {
    while (n > 0) {
      if (!(await this.fill(1))) throw new MetadataError('malformed')
      n -= this.take(Math.min(n, this.buf.length)).length
    }
  }
}
