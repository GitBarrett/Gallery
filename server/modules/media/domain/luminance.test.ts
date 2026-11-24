import { describe, expect, it } from 'vitest'
import { baseJpeg, basePng, baseWebp, HTML, pngImage } from '../../../../tests/builders/images'
import { sniffType } from './file-type'
import { decodePng, zoneLuminance } from './luminance'

const white = (): [number, number, number] => [255, 255, 255]
const black = (): [number, number, number] => [0, 0, 0]
// White bottom-left quarter, black elsewhere
const brightCorner = (x: number, y: number): [number, number, number] =>
  x < 32 && y >= 18 ? [255, 255, 255] : [0, 0, 0]
const gradient = (x: number, y: number): [number, number, number] => [x * 4, y * 7, (x * y) % 256]

const luminanceOf = async (png: Uint8Array<ArrayBuffer>) => zoneLuminance(await decodePng(png))

describe('luminance of the text zones', () => {
  it('US-14.1 is 0 on pure black and 1 on pure white, in both zones', async () => {
    expect(await luminanceOf(pngImage(64, 36, black))).toEqual({ bl: 0, tr: 0 })
    expect(await luminanceOf(pngImage(64, 36, white))).toEqual({ bl: 1, tr: 1 })
  })

  it('US-14.1 measures the bottom-left and top-right quarters apart', async () => {
    expect(await luminanceOf(pngImage(64, 36, brightCorner))).toEqual({ bl: 1, tr: 0 })
  })

  it('US-14.1 is the WCAG relative luminance (sRGB mid grey ≈ 0.216)', async () => {
    const { bl } = await luminanceOf(pngImage(64, 36, () => [128, 128, 128]))
    expect(bl).toBeCloseTo(0.2159, 4)
  })

  it('US-14.1 decodes every filter and colour type the binding may write', async () => {
    const reference = await decodePng(pngImage(16, 9, gradient))
    for (const colorType of [2, 6] as const) {
      const image = await decodePng(pngImage(16, 9, gradient, { colorType, filters: [0, 1, 2, 3, 4] }))
      for (const [x, y] of [
        [0, 0],
        [15, 0],
        [7, 4],
        [15, 8],
      ] as const)
        expect(image.rgb(x, y)).toEqual(reference.rgb(x, y))
    }
    const grey = (x: number): [number, number, number] => [x * 10, x * 10, x * 10]
    for (const colorType of [0, 3, 4] as const) {
      const image = await decodePng(pngImage(16, 9, grey, { colorType, filters: [4, 3, 2, 1] }))
      expect(image.rgb(9, 5)).toEqual([90, 90, 90])
    }
  })

  it('US-14.1 refuses what it cannot read rather than measuring garbage', async () => {
    const png = pngImage(16, 9, white)
    png[8 + 8 + 8] = 16 // IHDR bit depth
    await expect(decodePng(png)).rejects.toThrow('unsupported PNG')
    await expect(decodePng(new Uint8Array(basePng().subarray(0, 8)))).rejects.toThrow('unsupported PNG')
  })
})

describe('magic bytes', () => {
  it('US-10.3 recognises JPEG, PNG and WebP only', () => {
    expect(sniffType(baseJpeg())).toBe('image/jpeg')
    expect(sniffType(basePng())).toBe('image/png')
    expect(sniffType(baseWebp())).toBe('image/webp')
    expect(sniffType(HTML)).toBeNull()
    expect(sniffType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(sniffType(new Uint8Array([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull() // TGA header
  })
})
