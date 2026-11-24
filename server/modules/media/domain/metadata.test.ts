import { describe, expect, it } from 'vitest'
import type { CaptureType } from '../../../../shared/domain/capture-file'
import {
  ADOBE,
  baseJpeg,
  basePng,
  baseWebp,
  chunked,
  concat,
  EXIF_FLAG,
  exif,
  HTML,
  jpegExif,
  jpegSegment,
  jpegWith,
  jpegWithAdobe,
  pngChunk,
  pngWith,
  simpleWebp,
  webpChunk,
  webpWith,
  XMP,
  XMP_FLAG,
} from '../../../../tests/builders/images'
import { MetadataError, stripMetadata, strippedSize } from './metadata'

const ascii = (text: string) => new TextEncoder().encode(text)

/** Both passes of the consumer (T-22b): the final size first, then the bytes, which must have that size. */
async function strip(type: CaptureType, bytes: Uint8Array, chunk = 4096): Promise<Uint8Array> {
  const size = await strippedSize(type, chunked(bytes, chunk))
  if (!size.ok) throw new MetadataError(size.error)
  const parts: Uint8Array[] = []
  for await (const part of stripMetadata(type, chunked(bytes, chunk), size.value)) parts.push(part)
  const out = concat(...parts)
  expect(out.length).toBe(size.value)
  return out
}

const problem = async (type: CaptureType, bytes: Uint8Array) => {
  const size = await strippedSize(type, chunked(bytes))
  return size.ok ? null : size.error
}

const contains = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(text)

const riffSize = (bytes: Uint8Array, size: number) => {
  new DataView(bytes.buffer, bytes.byteOffset).setUint32(4, size, true)
  return bytes
}

describe('metadata stripping: JPEG', () => {
  const metadata = [
    jpegExif(1),
    jpegSegment(0xe1, concat(ascii('http://ns.adobe.com/xap/1.0/\0'), XMP)),
    jpegSegment(0xed, ascii('Photoshop 3.0\0IPTC by Ash')),
    ...[0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xef].map((m) => jpegSegment(m, ascii('vendor'))),
    jpegSegment(0xfe, ascii('shot by Ash')),
    jpegSegment(0xe2, ascii('MPF\0secondary image')),
  ]

  it.each([1, 7, 4096, 1 << 20])(
    'US-14.1 removes EXIF, XMP, IPTC, APP3-13, APP15 and comments, keeps JFIF, ICC and Adobe (chunks of %i bytes)',
    async (chunk) => {
      const out = await strip('image/jpeg', jpegWith([...metadata, ADOBE]), chunk)
      expect(out).toEqual(jpegWithAdobe())
      expect(contains(out, 'ICC_PROFILE')).toBe(true)
      expect(contains(out, 'Ash') || contains(out, 'ACME') || contains(out, 'MPF')).toBe(false)
    },
  )

  it('US-14.1 leaves a Display P3 JPEG without metadata unchanged (same pixels, ICC kept)', async () => {
    expect(await strip('image/jpeg', baseJpeg())).toEqual(baseJpeg())
  })

  it('US-14.1 drops what follows EOI, so a JPEG/HTML polyglot loses its HTML', async () => {
    const out = await strip('image/jpeg', jpegWith([jpegSegment(0xfe, HTML)], HTML))
    expect(out).toEqual(baseJpeg())
    expect(contains(out, '<html')).toBe(false)
  })

  it('US-14.1 keeps the entropy-coded data with stuffed bytes and restarts, and strips between scans', async () => {
    const sos = jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0]))
    const scan = new Uint8Array([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff])
    const soi = new Uint8Array([0xff, 0xd8])
    const eoi = new Uint8Array([0xff, 0xff, 0xd9]) // a fill byte before EOI, kept as it is
    const between = jpegSegment(0xfe, ascii('between scans'))
    const input = concat(soi, sos, scan, between, sos, scan.subarray(0, 7), eoi)
    for (const chunk of [1, 2, 3, 4096])
      expect(await strip('image/jpeg', input, chunk)).toEqual(concat(soi, sos, scan, sos, scan.subarray(0, 7), eoi))
  })

  it.each(['II', 'MM'] as const)('US-14.1 refuses an EXIF orientation other than 1 (%s byte order)', async (order) => {
    const rotated = jpegSegment(0xe1, concat(ascii('Exif\0\0'), exif(6, order)))
    expect(await problem('image/jpeg', jpegWith([rotated]))).toBe('orientation')
    expect(await problem('image/jpeg', jpegWith([jpegExif()]))).toBeNull()
  })

  it('US-14.1 strips an EXIF block too short to hold IFD0, or pointing past its end', async () => {
    const pastTheEnd = exif(6).fill(0xff, 4, 5)
    for (const block of [ascii('II*\0'), pastTheEnd])
      expect(await strip('image/jpeg', jpegWith([jpegSegment(0xe1, concat(ascii('Exif\0\0'), block))]))).toEqual(
        baseJpeg(),
      )
  })

  it('US-14.1 lets a failing source fail, not as a malformed file', async () => {
    async function* broken(): AsyncGenerator<Uint8Array> {
      yield baseJpeg().subarray(0, 10)
      throw new Error('stream reset')
    }
    await expect(strippedSize('image/jpeg', broken())).rejects.toThrow('stream reset')
  })

  it.each([
    ['another format', basePng()],
    ['a segment cut short', baseJpeg().subarray(0, 300)],
    ['a scan without EOI', baseJpeg().subarray(0, baseJpeg().length - 2)],
    ['a segment length below 2', concat(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 1]), baseJpeg().subarray(2))],
    ['no marker after a segment', concat(new Uint8Array([0xff, 0xd8, 0x00]), baseJpeg().subarray(2))],
  ])('US-14.1 refuses a malformed JPEG: %s', async (_, bytes) => {
    expect(await problem('image/jpeg', bytes)).toBe('malformed')
  })

  it('US-14.1 raises the problem in the second pass too', async () => {
    const pass = stripMetadata('image/jpeg', chunked(basePng()), 0)
    await expect(pass.next()).rejects.toMatchObject({ problem: 'malformed' })
  })
})

describe('metadata stripping: PNG', () => {
  const text = [
    pngChunk('tEXt', ascii('Author\0Ash')),
    pngChunk('iTXt', ascii('Comment\0\0\0\0\0shot by Ash')),
    pngChunk('zTXt', ascii('Software\0\0x')),
    pngChunk('tIME', new Uint8Array([7, 234, 11, 24, 20, 0, 0])),
    pngChunk('eXIf', exif(1)),
  ]

  it.each([1, 13, 4096])(
    'US-14.1 removes eXIf, tEXt, iTXt, zTXt and tIME before and after the image, keeps iCCP (chunks of %i bytes)',
    async (chunk) => {
      const out = await strip('image/png', pngWith(text, text), chunk)
      expect(out).toEqual(basePng())
      expect(contains(out, 'iCCP')).toBe(true)
    },
  )

  it('US-14.1 keeps sRGB, gAMA and cHRM', async () => {
    const colour = [pngChunk('sRGB', new Uint8Array([0])), pngChunk('gAMA', new Uint8Array([0, 0, 0xb1, 0x8f]))]
    colour.push(pngChunk('cHRM', new Uint8Array(32)))
    expect(await strip('image/png', pngWith([...colour, ...text]))).toEqual(pngWith(colour))
  })

  it('US-14.1 drops what follows IEND', async () => {
    expect(await strip('image/png', pngWith([], [], HTML))).toEqual(basePng())
  })

  it('US-14.1 refuses an eXIf orientation other than 1', async () => {
    expect(await problem('image/png', pngWith([pngChunk('eXIf', exif(8, 'MM'))]))).toBe('orientation')
  })

  it.each([
    ['another format', baseJpeg()],
    ['a chunk cut short', basePng().subarray(0, 500)],
    ['no IEND', basePng().subarray(0, basePng().length - 12)],
  ])('US-14.1 refuses a malformed PNG: %s', async (_, bytes) => {
    expect(await problem('image/png', bytes)).toBe('malformed')
  })
})

describe('metadata stripping: WebP', () => {
  const metadata = [webpChunk('EXIF', exif(1)), webpChunk('XMP ', XMP)]

  it.each([1, 9, 4096])(
    'US-14.1 removes EXIF and XMP, clears their VP8X flags and updates the RIFF size (chunks of %i bytes)',
    async (chunk) => {
      const input = webpWith(metadata, EXIF_FLAG | XMP_FLAG)
      const out = await strip('image/webp', input, chunk)
      expect(out).toEqual(baseWebp())
      expect(out.length).toBeLessThan(input.length)
    },
  )

  it('US-14.1 leaves a simple WebP (no VP8X) unchanged and drops what follows the RIFF', async () => {
    expect(await strip('image/webp', concat(simpleWebp(), HTML))).toEqual(simpleWebp())
  })

  it('US-14.1 refuses an EXIF orientation other than 1, with or without the Exif header', async () => {
    for (const block of [exif(3), concat(ascii('Exif\0\0'), exif(3, 'MM'))])
      expect(await problem('image/webp', webpWith([webpChunk('EXIF', block)], EXIF_FLAG))).toBe('orientation')
  })

  it.each([
    ['another format', basePng()],
    ['a RIFF cut short', baseWebp().subarray(0, 200)],
    ['a chunk past the RIFF size', riffSize(webpWith([], 0, webpChunk('XMP ', XMP)), baseWebp().length - 8 + 10)],
    [
      'a RIFF ending inside a chunk header',
      riffSize(webpWith([], 0, webpChunk('XMP ', XMP)), baseWebp().length - 8 + 4),
    ],
    ['a RIFF that is not WebP', concat(ascii('RIFF'), new Uint8Array([4, 0, 0, 0]), ascii('WAVE'))],
  ])('US-14.1 refuses a malformed WebP: %s', async (_, bytes) => {
    expect(await problem('image/webp', bytes)).toBe('malformed')
  })
})
