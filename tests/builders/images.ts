import { readFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

// Builds captures with metadata around the pixel files of tests/fixtures/images (made by Chromium's canvas:
// display-p3.jpg has a real ICC APP2, display-p3.png an iCCP chunk, srgb.webp a VP8X with ICCP). The stripper tests
// compare whole files: stripping a built capture gives back the base file byte for byte, so the pixels are identical.

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/images/${name}`, import.meta.url)))
export const baseJpeg = () => fixture('display-p3.jpg')
export const basePng = () => fixture('display-p3.png')
export const baseWebp = () => fixture('srgb.webp')

const ascii = (text: string) => new TextEncoder().encode(text)
export const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0)
  return out
}
const u16be = (n: number) => new Uint8Array([n >> 8, n & 0xff])
const u32be = (n: number) => new Uint8Array([n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
const u32le = (n: number) => u32be(n).reverse()

/** TIFF block of an EXIF with a camera make in IFD0 and, when given, an Orientation tag (0x0112). */
export function exif(orientation?: number, order: 'II' | 'MM' = 'II'): Uint8Array {
  const le = order === 'II'
  const u16 = (n: number) => (le ? u16be(n).reverse() : u16be(n))
  const u32 = (n: number) => (le ? u32le(n) : u32be(n))
  const entries = [concat(u16(0x010f), u16(2), u32(4), ascii('ACME'))] // Make, ASCII, 4 bytes inline
  if (orientation !== undefined) entries.push(concat(u16(0x0112), u16(3), u32(1), u16(orientation), u16(0)))
  return concat(ascii(order), u16(42), u32(8), u16(entries.length), ...entries, u32(0))
}

export const XMP = ascii(
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><dc:creator>Ash</dc:creator></rdf:RDF></x:xmpmeta>',
)
export const HTML = ascii('<html><script>alert(1)</script></html>')

// JPEG

export const jpegSegment = (marker: number, payload: Uint8Array) =>
  concat(new Uint8Array([0xff, marker]), u16be(payload.length + 2), payload)
export const jpegExif = (orientation?: number) => jpegSegment(0xe1, concat(ascii('Exif\0\0'), exif(orientation)))
export const ADOBE = jpegSegment(0xee, concat(ascii('Adobe'), new Uint8Array([0, 100, 0, 0, 0, 0, 1])))

/** Inserts segments after the APP0 and APP2 of the base file (offset of its DQT), and appends bytes after EOI. */
export function jpegWith(segments: Uint8Array[], trailer = new Uint8Array()): Uint8Array {
  const base = baseJpeg()
  const dqt = base.findIndex((b, i) => b === 0xff && base[i + 1] === 0xdb)
  return concat(base.subarray(0, dqt), ...segments, base.subarray(dqt), trailer)
}

/** The base file with ADOBE kept at the same place: what stripping jpegWith([...metadata, ADOBE]) must give. */
export const jpegWithAdobe = () => jpegWith([ADOBE])

// PNG

export const pngChunk = (type: string, data: Uint8Array) => {
  const body = concat(ascii(type), data)
  return concat(u32be(data.length), body, u32be(crc32(body)))
}

/** Inserts chunks after IHDR (before iCCP) and others before IEND, and appends bytes after IEND. */
export function pngWith(early: Uint8Array[], late: Uint8Array[] = [], trailer = new Uint8Array()): Uint8Array {
  const base = basePng()
  const afterIhdr = 8 + 25
  const iend = base.length - 12
  return concat(
    base.subarray(0, afterIhdr),
    ...early,
    base.subarray(afterIhdr, iend),
    ...late,
    base.subarray(iend),
    trailer,
  )
}

// WebP

export const webpChunk = (fourcc: string, data: Uint8Array) =>
  concat(ascii(fourcc), u32le(data.length), data, new Uint8Array(data.length % 2))

/** Appends chunks after the image, sets the VP8X flags they need and fixes the RIFF size; bytes after the RIFF too. */
export function webpWith(chunks: Uint8Array[], flags = 0, trailer = new Uint8Array()): Uint8Array {
  const base = baseWebp()
  const body = concat(base.subarray(12), ...chunks)
  body[8] = body[8]! | flags // VP8X flags byte: first chunk, after its 8-byte header
  return concat(ascii('RIFF'), u32le(body.length + 4), ascii('WEBP'), body, trailer)
}
export const EXIF_FLAG = 0x08
export const XMP_FLAG = 0x04

/** Simple format (no VP8X): the bare VP8 chunk of the base file. */
export function simpleWebp(): Uint8Array {
  const base = baseWebp()
  const vp8 = base.findIndex(
    (b, i) => b === 0x56 && base[i + 1] === 0x50 && base[i + 2] === 0x38 && base[i + 3] === 0x20,
  )
  const body = base.subarray(vp8)
  return concat(ascii('RIFF'), u32le(body.length + 4), ascii('WEBP'), body)
}

/** Feeds bytes in chunks of `size`, as a stream from R2 would. */
export async function* chunked(bytes: Uint8Array, size = 4096): AsyncGenerator<Uint8Array> {
  for (let at = 0; at < bytes.length; at += size) yield bytes.slice(at, at + size)
}

/**
 * A PNG of `pixel(x, y)` (RGB 0–255), as the Images binding writes the luminance thumbnail: 8-bit RGB by default,
 * or grey, palette (the first 256 colours met) or with alpha; rows filtered in turn by `filters` (0 None to 4 Paeth).
 */
export function pngImage(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
  {
    colorType = 2,
    filters = [0],
    bitDepth = 8,
  }: { colorType?: 0 | 2 | 3 | 4 | 6; filters?: number[]; bitDepth?: 1 | 2 | 4 | 8 } = {},
): Uint8Array<ArrayBuffer> {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  const palette: number[][] = []
  const samples = (x: number, y: number) => {
    const [r, g, b] = pixel(x, y)
    if (colorType === 0) return [Math.round((r * ((1 << bitDepth) - 1)) / 255)]
    if (colorType === 4) return [r, 255]
    if (colorType === 6) return [r, g, b, 255]
    if (colorType === 2) return [r, g, b]
    let index = palette.findIndex((c) => c[0] === r && c[1] === g && c[2] === b)
    if (index === -1) index = palette.push([r, g, b]) - 1
    return [index]
  }
  // Below 8 bits (grey and palette only), the samples of a row are packed, most significant bits first
  const pack = (values: number[]) =>
    bitDepth === 8
      ? values
      : Array.from({ length: Math.ceil((values.length * bitDepth) / 8) }, (_, i) =>
          values
            .slice((i * 8) / bitDepth, ((i + 1) * 8) / bitDepth)
            .reduce((byte, v, j) => byte | (v << (8 - bitDepth * (j + 1))), 0),
        )
  const rows = Array.from({ length: height }, (_, y) =>
    pack(Array.from({ length: width }, (_, x) => samples(x, y)).flat()),
  )
  const stride = rows[0]!.length
  const bpp = Math.max(1, (channels * bitDepth) / 8)
  const raw: number[] = []
  rows.forEach((row, y) => {
    const filter = filters[y % filters.length]!
    raw.push(filter)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp]! : 0
      const b = y > 0 ? rows[y - 1]![x]! : 0
      const c = x >= bpp && y > 0 ? rows[y - 1]![x - bpp]! : 0
      const p = a + b - c
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c
      raw.push((row[x]! - [0, a, b, (a + b) >> 1, paeth][filter]! + 256) & 0xff)
    }
  })
  const ihdr = concat(u32be(width), u32be(height), new Uint8Array([bitDepth, colorType, 0, 0, 0]))
  return new Uint8Array(
    concat(
      PNG_SIGNATURE_BYTES,
      pngChunk('IHDR', ihdr),
      ...(colorType === 3 ? [pngChunk('PLTE', new Uint8Array(palette.flat()))] : []),
      pngChunk('IDAT', new Uint8Array(deflateSync(new Uint8Array(raw)))),
      pngChunk('IEND', new Uint8Array()),
    ),
  )
}
const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
