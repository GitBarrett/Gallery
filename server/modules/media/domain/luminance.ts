// Luminance of the text zones (07-design.md § Texte sur image 4), read on the 64 px PNG made by the Images binding:
// the only image decoded in the Worker (03-architecture.md § Pipeline image), ≈ 16 KB of pixels.

export interface Luminance {
  /** Mean relative luminance (WCAG, 0–1) of the bottom-left quarter, where the text of heroes and banners sits. */
  bl: number
  /** Same, top-right quarter (badges). */
  tr: number
}

interface Pixels {
  width: number
  height: number
  /** RGB of the pixel (x, y), 0–255. */
  rgb(x: number, y: number): [number, number, number]
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } // grey, RGB, palette, grey+alpha, RGBA

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Non-interlaced PNG, 8 bits per sample, or 1, 2 or 4 for grey and palette (what the binding writes for a flat or
 * few-colour image); throws on anything else. Alpha is ignored: captures are opaque.
 */
export async function decodePng(png: Uint8Array<ArrayBuffer>): Promise<Pixels> {
  const chunks = readChunks(png)
  const { width, height, colorType, channels, depth } = readHeader(chunks.get('IHDR')?.[0])
  const palette = chunks.get('PLTE')?.[0] ?? new Uint8Array()
  const raw = await inflate(new Uint8Array(await new Blob(chunks.get('IDAT') ?? []).arrayBuffer()))
  const stride = Math.ceil((width * channels * depth) / 8)
  const pixels = unfilter(raw, stride, height, Math.max(1, (channels * depth) / 8))
  // First sample of the pixel; below 8 bits, unpacked from its byte (most significant bits first)
  const sample = (x: number, y: number) => {
    if (depth === 8) return pixels[y * stride + x * channels]!
    const bit = x * depth
    return (pixels[y * stride + (bit >> 3)]! >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
  }
  return {
    width,
    height,
    rgb(x, y) {
      const value = sample(x, y)
      if (colorType === 3) return [palette[value * 3]!, palette[value * 3 + 1]!, palette[value * 3 + 2]!]
      const grey = Math.round((value * 255) / ((1 << depth) - 1))
      if (channels <= 2) return [grey, grey, grey]
      const at = y * stride + x * channels
      return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!]
    },
  }
}

// 8 bits per sample, or 1, 2 and 4 for grey and palette
const supportedDepth = (depth: number, colorType: number) =>
  depth === 8 || ([1, 2, 4].includes(depth) && (colorType === 0 || colorType === 3))

function readHeader(header: Uint8Array | undefined) {
  if (!header || header.length < 13 || header[12] !== 0) throw new Error('unsupported PNG')
  const view = new DataView(header.buffer, header.byteOffset, header.length)
  const [width, height, depth, colorType] = [view.getUint32(0), view.getUint32(4), header[8]!, header[9]!]
  const channels = CHANNELS[colorType]
  if (!channels || !width || !height || !supportedDepth(depth, colorType)) throw new Error('unsupported PNG')
  return { width, height, colorType, channels, depth }
}

/** Data of the chunks by type, in order, up to IEND. */
function readChunks(png: Uint8Array<ArrayBuffer>): Map<string, Uint8Array<ArrayBuffer>[]> {
  const view = new DataView(png.buffer, png.byteOffset, png.length)
  const chunks = new Map<string, Uint8Array<ArrayBuffer>[]>()
  for (let at = 8; at + 8 <= png.length;) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    if (type === 'IEND') break
    chunks.set(type, [...(chunks.get(type) ?? []), png.subarray(at + 8, at + 8 + length)])
    at += 12 + length
  }
  return chunks
}

/** PNG filters (None, Sub, Up, Average, Paeth), row by row; each row starts with its filter byte. */
function unfilter(raw: Uint8Array, stride: number, height: number, bpp: number): Uint8Array {
  if (raw.length < (stride + 1) * height) throw new Error('truncated PNG')
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x]!
      const a = x >= bpp ? out[row + x - bpp]! : 0
      const b = y > 0 ? out[row - stride + x]! : 0
      const c = x >= bpp && y > 0 ? out[row - stride + x - bpp]! : 0
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]
      if (predictor === undefined) throw new Error('unknown PNG filter')
      out[row + x] = (value + predictor) & 0xff
    }
  }
  return out
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

const linear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function meanLuminance(image: Pixels, x0: number, x1: number, y0: number, y1: number) {
  let sum = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = image.rgb(x, y)
      sum += 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }
  return sum / Math.max(1, (x1 - x0) * (y1 - y0))
}

export function zoneLuminance(image: Pixels): Luminance {
  const midX = Math.floor(image.width / 2)
  const midY = Math.floor(image.height / 2)
  return {
    bl: meanLuminance(image, 0, Math.max(1, midX), midY, image.height),
    tr: meanLuminance(image, midX, image.width, 0, Math.max(1, midY)),
  }
}
