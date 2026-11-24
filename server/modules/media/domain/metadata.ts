import type { CaptureType } from '../../../../shared/domain/capture-file'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { ByteReader } from './byte-reader'
import { checkOrientation, MetadataError, type MetadataProblem } from './metadata-error'

export { MetadataError, type MetadataProblem } from './metadata-error'

// Metadata removed at the byte level, streamed, without re-encoding (ADR-011, 03-architecture.md § Pipeline image):
// the pixels of the original are untouched. Kept: what renders the colours (JFIF, ICC, Adobe; iCCP, sRGB, gAMA,
// cHRM; VP8X, ICCP). Bytes after the end of the image (EOI, IEND, RIFF size) are dropped: they are not part of it
// and are where a polyglot hides its payload.

/** Longest EXIF block read for the orientation; IFD0 sits at its start, the rest is skipped. */
const EXIF_HEAD = 65_536
const malformed = () => new MetadataError('malformed')
const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0))
const text = (data: Uint8Array) => String.fromCharCode(...data)
const startsWith = (data: Uint8Array, prefix: Uint8Array) => prefix.every((b, i) => data[i] === b)
const u16be = (data: Uint8Array, at: number) => (data[at]! << 8) | data[at + 1]!
const u32 = (data: Uint8Array, at: number, le: boolean) =>
  new DataView(data.buffer, data.byteOffset, data.length).getUint32(at, le)
const u32le = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff])

/**
 * The capture without its metadata. `size` is the final size from `strippedSize` (first pass), written in the WebP
 * RIFF header; the consumer writes this second pass into a FixedLengthStream of that size (T-22b).
 * Throws a MetadataError, already reported by the first pass.
 */
export function stripMetadata(type: CaptureType, source: AsyncIterable<Uint8Array>, size: number) {
  const reader = new ByteReader(source)
  return type === 'image/jpeg' ? jpeg(reader) : type === 'image/png' ? png(reader) : webp(reader, size)
}

/** First pass: checks the file and gives the size of the stripped capture. */
export async function strippedSize(
  type: CaptureType,
  source: AsyncIterable<Uint8Array>,
): Promise<Result<number, MetadataProblem>> {
  let size = 0
  try {
    for await (const part of stripMetadata(type, source, 0)) size += part.length
  } catch (error) {
    if (error instanceof MetadataError) return err(error.problem)
    throw error
  }
  return ok(size)
}

/** Reads an EXIF block for its orientation, then skips it with `extra` trailing bytes (CRC, padding). */
async function dropExif(reader: ByteReader, length: number, extra: number) {
  const head = await reader.read(Math.min(length, EXIF_HEAD))
  checkOrientation(head)
  await reader.skip(length - head.length + extra)
}

// JPEG: marker segments up to each scan, entropy-coded data until the next marker, EOI.

const EXIF = bytes('Exif\0\0')
const ICC = bytes('ICC_PROFILE\0')
const COM = 0xfe
const SOS = 0xda
const EOI = 0xd9

async function* jpeg(reader: ByteReader): AsyncGenerator<Uint8Array> {
  const soi = await reader.read(2)
  if (soi[0] !== 0xff || soi[1] !== 0xd8) throw malformed()
  yield soi
  for (;;) {
    const marker = await nextMarker(reader)
    if (marker === EOI) return yield new Uint8Array([0xff, EOI])
    // RSTn only occur inside scan data (entropyCodedData); every other marker here has a length
    const length = await reader.read(2)
    if (u16be(length, 0) < 2) throw malformed()
    const header = new Uint8Array([0xff, marker, length[0]!, length[1]!])
    if ((marker >= 0xe0 && marker <= 0xef) || marker === COM) yield* appSegment(reader, header)
    else {
      yield header
      yield* reader.pass(u16be(length, 0) - 2)
      if (marker === SOS) yield* entropyCodedData(reader)
    }
  }
}

/** The next marker code, after the fill bytes 0xFF that may precede it. */
async function nextMarker(reader: ByteReader): Promise<number> {
  if ((await reader.read(1))[0] !== 0xff) throw malformed()
  let marker = 0xff
  while (marker === 0xff) marker = (await reader.read(1))[0]!
  if (marker === 0) throw malformed()
  return marker
}

/** APPn and COM: kept only for APP0 (JFIF), APP2 ICC_PROFILE and APP14 (Adobe); EXIF checked for its orientation. */
async function* appSegment(reader: ByteReader, header: Uint8Array): AsyncGenerator<Uint8Array> {
  const marker = header[1]
  const payload = await reader.read(u16be(header, 2) - 2)
  if (marker === 0xe1 && startsWith(payload, EXIF)) checkOrientation(payload.subarray(EXIF.length))
  if (marker === 0xe0 || marker === 0xee || (marker === 0xe2 && startsWith(payload, ICC))) {
    yield header
    yield payload
  }
}

/** Passes the scan data through, up to the marker that ends it (left unread). */
async function* entropyCodedData(reader: ByteReader): AsyncGenerator<Uint8Array> {
  for (;;) {
    if (!(await reader.fill(2))) throw malformed()
    const view = reader.view
    const end = markerOffset(view)
    if (end > 0) yield reader.take(end)
    if (end < view.length - 1) return
  }
}

/** Offset of the first marker in scan data (0xFF not followed by 0x00, RSTn or a fill byte), else of the last byte. */
function markerOffset(view: Uint8Array): number {
  for (let at = view.indexOf(0xff); at !== -1 && at + 1 < view.length; at = view.indexOf(0xff, at + 1)) {
    const next = view[at + 1]!
    if (next !== 0 && next !== 0xff && (next < 0xd0 || next > 0xd7)) return at
  }
  return view.length - 1
}

// PNG: signature, then chunks (length, type, data, CRC) up to IEND.

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])

async function* png(reader: ByteReader): AsyncGenerator<Uint8Array> {
  const signature = await reader.read(8)
  if (!startsWith(signature, PNG_SIGNATURE)) throw malformed()
  yield signature
  for (;;) {
    const header = await reader.read(8)
    const length = u32(header, 0, false)
    const type = text(header.subarray(4))
    if (length > 0x7fffffff) throw malformed()
    if (type === 'eXIf') await dropExif(reader, length, 4)
    else if (PNG_DROPPED.has(type)) await reader.skip(length + 4)
    else {
      yield header
      yield* reader.pass(length + 4)
    }
    if (type === 'IEND') return
  }
}

// WebP: RIFF header, then chunks (FourCC, length, data, padding to an even length) up to the RIFF size.

const EXIF_FLAG = 0x08
const XMP_FLAG = 0x04

async function* webp(reader: ByteReader, size: number): AsyncGenerator<Uint8Array> {
  const head = await reader.read(12)
  if (text(head.subarray(0, 4)) !== 'RIFF' || text(head.subarray(8)) !== 'WEBP') throw malformed()
  yield new Uint8Array([...bytes('RIFF'), ...u32le(size - 8), ...bytes('WEBP')])
  let left = u32(head, 4, true) - 4
  while (left > 0) {
    if (left < 8) throw malformed()
    const header = await reader.read(8)
    const length = u32(header, 4, true)
    const padded = length + (length % 2)
    left -= 8 + padded
    if (left < 0) throw malformed()
    yield* webpChunk(reader, header, length, padded)
  }
}

async function* webpChunk(
  reader: ByteReader,
  header: Uint8Array,
  length: number,
  padded: number,
): AsyncGenerator<Uint8Array> {
  const fourcc = text(header.subarray(0, 4))
  if (fourcc === 'EXIF') return await dropExif(reader, length, padded - length)
  if (fourcc === 'XMP ') return await reader.skip(padded)
  yield header
  if (fourcc !== 'VP8X') return yield* reader.pass(padded)
  const vp8x = (await reader.read(padded)).slice()
  vp8x[0] = vp8x[0]! & ~(EXIF_FLAG | XMP_FLAG)
  yield vp8x
}
