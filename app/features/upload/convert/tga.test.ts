import { describe, expect, it } from 'vitest'
import { chainOf, convertedName, isLossy, sourceOf } from './chain'
import { decodeTga, tgaSize } from './tga'

// A TGA as WoW writes it: header, then BGR(A) pixels, bottom row first unless bit 5 of the descriptor is set
function tga(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number[],
  options: { bits?: 24 | 32; top?: boolean; rle?: boolean } = {},
) {
  const { bits = 24, top = false, rle = false } = options
  const header = new Array<number>(18).fill(0)
  header[2] = rle ? 10 : 2
  header.splice(12, 6, width & 255, width >> 8, height & 255, height >> 8, bits, top ? 0x20 : 0)
  const body: number[] = []
  for (let r = 0; r < height; r++) {
    const y = top ? r : height - 1 - r
    for (let x = 0; x < width; x++) {
      const [red, green, blue, alpha = 255] = pixel(x, y)
      const bgra = bits === 32 ? [blue!, green!, red!, alpha] : [blue!, green!, red!]
      body.push(...(rle ? [0, ...bgra] : bgra)) // RLE: one raw packet of one pixel each
    }
  }
  return new Uint8Array([...header, ...body])
}
const at = (image: ReturnType<typeof decodeTga>, x: number, y: number) => [
  ...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4),
]
const colours = (x: number, y: number) => [x * 40, y * 60, 200]

describe('TGA decoder', () => {
  it('US-10.1 decodes a raw 24-bit TGA, bottom row first, into RGBA top row first', () => {
    const image = decodeTga(tga(4, 3, colours))
    expect([image.width, image.height]).toEqual([4, 3])
    expect(at(image, 0, 0)).toEqual([0, 0, 200, 255])
    expect(at(image, 3, 2)).toEqual([120, 120, 200, 255])
  })

  it('US-10.1 decodes 32 bits with alpha, the top-left origin and run-length packets', () => {
    expect(at(decodeTga(tga(4, 3, (x, y) => [...colours(x, y), 128], { bits: 32, top: true })), 3, 2)).toEqual([
      120, 120, 200, 128,
    ])
    expect(at(decodeTga(tga(4, 3, colours, { rle: true })), 2, 1)).toEqual([80, 60, 200, 255])
    // A repeated run: one packet for a whole row of the same colour
    const run = new Uint8Array([0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 1, 0, 24, 0, 0x83, 10, 20, 30])
    expect(at(decodeTga(run), 3, 0)).toEqual([30, 20, 10, 255])
  })

  it('reads the size from the header, and refuses a truncated or unsupported file', () => {
    expect(tgaSize(tga(7680, 1, colours).subarray(0, 18))).toEqual({ width: 7680, height: 1 })
    expect(() => decodeTga(tga(4, 3, colours).subarray(0, 30))).toThrow('truncated TGA')
    const colourMapped = tga(4, 3, colours)
    colourMapped[2] = 1
    expect(() => decodeTga(colourMapped)).toThrow('unsupported TGA')
    expect(tgaSize(new Uint8Array(10))).toBeNull()
  })
})

describe('conversion chain', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size })

  it('US-10.9 converts a TGA and a PNG over 20 MB, nothing else', () => {
    expect(sourceOf(file('WoWScrnShot_111426.tga', '', 8_000_000))).toBe('tga')
    expect(sourceOf(file('shot.TGA', 'image/x-tga', 30_000_000))).toBe('tga')
    expect(sourceOf(file('big.png', 'image/png', 20_000_001))).toBe('png')
    expect(sourceOf(file('small.png', 'image/png', 20_000_000))).toBeNull()
    expect(sourceOf(file('big.jpg', 'image/jpeg', 25_000_000))).toBeNull() // refused as it is: over 20 MB
  })

  it('US-10.9 tries the lossless formats first, the JPEG last and only it with a warning; never a lossy WebP', () => {
    expect(chainOf('tga')).toEqual(['png', 'webp', 'jpeg'])
    expect(chainOf('png')).toEqual(['webp', 'jpeg'])
    expect(['png', 'webp', 'jpeg'].map((e) => isLossy(e as 'png'))).toEqual([false, false, true])
    expect(convertedName('WoWScrnShot.tga', 'jpeg')).toBe('WoWScrnShot.jpg')
    expect(convertedName('big.png', 'webp')).toBe('big.webp')
  })
})
