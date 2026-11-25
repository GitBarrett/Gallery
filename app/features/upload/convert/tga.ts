// TGA decoder (03 § Pipeline image 1: "décodé en JS"): what WoW writes, true-colour 24 or 32 bits, raw (type 2) or
// run-length encoded (type 10), either origin. Anything else is refused rather than decoded wrong.

export interface Rgba {
  width: number
  height: number
  /** RGBA, top row first: what the encoders take (ImageData). */
  data: Uint8ClampedArray<ArrayBuffer>
}

/** Width and height from the 18-byte header, without decoding (to check the rules before converting). */
export function tgaSize(header: Uint8Array): { width: number; height: number } | null {
  if (header.length < 18 || ![2, 10].includes(header[2]!) || ![24, 32].includes(header[16]!)) return null
  return { width: header[12]! | (header[13]! << 8), height: header[14]! | (header[15]! << 8) }
}

export function decodeTga(file: Uint8Array): Rgba {
  const size = tgaSize(file)
  if (!size || !size.width || !size.height) throw new Error('unsupported TGA')
  const { width, height } = size
  const bytesPerPixel = file[16]! / 8
  const topFirst = (file[17]! & 0x20) !== 0
  const out = new Uint8ClampedArray(width * height * 4)
  let at = 18 + file[0]! // after the image id
  let pixel = 0
  const write = (from: number) => {
    const row = Math.floor(pixel / width)
    const target = ((topFirst ? row : height - 1 - row) * width + (pixel % width)) * 4
    out[target] = file[from + 2]! // stored as BGR(A)
    out[target + 1] = file[from + 1]!
    out[target + 2] = file[from]!
    out[target + 3] = bytesPerPixel === 4 ? file[from + 3]! : 255
    pixel++
  }
  const total = width * height
  while (pixel < total) {
    if (file[2] === 2) {
      write(at)
      at += bytesPerPixel
      continue
    }
    const packet = file[at++]
    if (packet === undefined) break
    const count = (packet & 0x7f) + 1
    if (packet & 0x80) {
      for (let i = 0; i < count && pixel < total; i++) write(at)
      at += bytesPerPixel
    } else {
      for (let i = 0; i < count && pixel < total; i++, at += bytesPerPixel) write(at)
    }
  }
  if (pixel < total || at > file.length) throw new Error('truncated TGA')
  return { width, height, data: out }
}
