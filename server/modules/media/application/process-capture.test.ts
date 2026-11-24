import { describe, expect, it } from 'vitest'
import {
  baseJpeg,
  concat,
  basePng,
  HTML,
  jpegExif,
  jpegSegment,
  jpegWith,
  pngChunk,
  pngWith,
  XMP,
} from '../../../../tests/builders/images'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import type { ImageInfo } from './ports'
import { failCapture, processCapture } from './process-capture'

const ID = '0193a000-0000-7000-8000-0000000000aa'
const ascii = (text: string) => new TextEncoder().encode(text)
const VARIANT_KEYS = ['1200.jpg', '400.webp', '800.webp', '1200.webp', '2400.webp'].map((n) => `variants/${ID}/${n}`)
// Bright bottom-left quarter of the 64 × 36 thumbnail, dark elsewhere
const brightCorner = (x: number, y: number): [number, number, number] =>
  x < 32 && y >= 18 ? [255, 255, 255] : [0, 0, 0]

async function setup(
  file: Uint8Array,
  { mime = 'image/jpeg', info }: { mime?: 'image/jpeg' | 'image/png'; info?: Partial<ImageInfo> } = {},
) {
  const clock = { now: () => new Date('2026-11-24T10:00:00Z') }
  const { repo, rows } = inMemoryMediaRepository(clock)
  const { storage, objects } = inMemoryObjectStorage()
  const fake = fakeImageService({ format: mime, width: 1920, height: 1080, ...info }, brightCorner)
  await repo.createUpload({ id: ID, userId: 'u-ash', mime, bytes: file.length, width: 1920, height: 1080 })
  await repo.complete(ID, { title: 'Dusk', gameVersion: 'wow-forever', at: clock.now() })
  objects.set(`incoming/${ID}`, { bytes: file.length, contentType: mime, data: file })
  const deps = { repo, storage, images: fake.images }
  return { ...fake, deps, process: () => processCapture(deps)(ID), rows, objects }
}

describe('capture processing', () => {
  it('US-14.1 US-10.4 strips the metadata without re-encoding, writes the variants and records the measures', async () => {
    const xmp = jpegSegment(0xe1, concat(ascii('http://ns.adobe.com/xap/1.0/\0'), XMP))
    const iptc = jpegSegment(0xed, ascii('Photoshop 3.0\0IPTC'))
    const s = await setup(jpegWith([jpegExif(), xmp, iptc, jpegSegment(0xfe, ascii('a comment'))]))

    expect(await s.process()).toBe('processed')
    // The base file byte for byte: no EXIF, XMP, IPTC nor comment, the ICC profile and the pixels untouched
    expect(s.objects.get(`originals/${ID}`)).toMatchObject({ contentType: 'image/jpeg', data: baseJpeg() })
    expect(s.objects.has(`incoming/${ID}`)).toBe(false)
    for (const key of VARIANT_KEYS) expect(s.objects.has(key)).toBe(true)
    expect(s.objects.get(`variants/${ID}/1200.jpg`)?.contentType).toBe('image/jpeg')
    expect(s.objects.get(`variants/${ID}/800.webp`)?.contentType).toBe('image/webp')
    expect(s.objects.has(`variants/${ID}/64.png`)).toBe(false) // decoded, never written
    expect(s.rows.get(ID)).toMatchObject({
      status: 'pending_review',
      bytes: baseJpeg().length,
      processed: { bytes: baseJpeg().length, width: 1920, height: 1080, lumaBl: 1, lumaTr: 0 },
    })
  })

  it('US-10.4 keeps the colour profile of a PNG and drops its text chunks', async () => {
    const png = pngWith([pngChunk('tEXt', ascii('Author\0Ash'))], [pngChunk('tIME', new Uint8Array(7))])
    const s = await setup(png, { mime: 'image/png' })
    expect(await s.process()).toBe('processed')
    expect(s.objects.get(`originals/${ID}`)?.data).toEqual(basePng())
  })

  it('US-14.6 calls exactly 6 transformations: the 64 px thumbnail, the 1200 JPEG and the four WebP', async () => {
    const s = await setup(baseJpeg())
    await s.process()
    expect(s.renders).toEqual([
      { width: 64, format: 'image/png', quality: undefined },
      { width: 1200, format: 'image/jpeg', quality: 85 },
      { width: 400, format: 'image/webp', quality: 82 },
      { width: 800, format: 'image/webp', quality: 82 },
      { width: 1200, format: 'image/webp', quality: 82 },
      { width: 2400, format: 'image/webp', quality: 82 },
    ])
  })

  it('US-14.2 does nothing more when the message comes again: same objects, no new transformation', async () => {
    const s = await setup(baseJpeg())
    await s.process()
    const objects = new Map(s.objects)
    expect(await s.process()).toBe('skipped')
    expect(s.objects).toEqual(objects)
    expect(s.renders).toHaveLength(6)
  })

  it('US-14.2 starts again from the cleaned original when a first run stopped after writing it', async () => {
    const s = await setup(jpegWith([jpegExif()]))
    s.state.failing = true
    s.objects.set(`originals/${ID}`, { bytes: baseJpeg().length, contentType: 'image/jpeg', data: baseJpeg() })
    s.objects.delete(`incoming/${ID}`)
    await expect(s.process()).rejects.toThrow('Images unavailable')
    s.state.failing = false
    expect(await s.process()).toBe('processed')
    expect(s.objects.get(`originals/${ID}`)?.data).toEqual(baseJpeg())
    expect(s.rows.get(ID)?.status).toBe('pending_review')
  })

  it('US-10.3 rejects a file whose content is not a capture, without calling the service', async () => {
    const s = await setup(HTML, { mime: 'image/jpeg' })
    expect(await s.process()).toBe('rejected')
    expect(s.rows.get(ID)?.status).toBe('failed')
    expect([...s.objects.keys()]).toEqual([])
    expect(s.state.infoCalls).toBe(0)
  })

  it('US-10.3 rejects a type other than declared, read by the magic bytes or by the service', async () => {
    expect(await (await setup(basePng(), { mime: 'image/jpeg' })).process()).toBe('rejected')
    const s = await setup(baseJpeg(), { info: { format: 'image/webp' } })
    expect(await s.process()).toBe('rejected')
    expect(s.renders).toEqual([])
  })

  it.each([
    ['wider than 7680 px', { width: 7681, height: 1080 }],
    ['over 33.2 Mpx', { width: 7680, height: 4321 }],
    ['undecoded dimensions (SVG)', { width: 0, height: 0 }],
  ])('US-10.3 rejects dimensions %s read by the service', async (_, info) => {
    const s = await setup(baseJpeg(), { info })
    expect(await s.process()).toBe('rejected')
    expect(s.rows.get(ID)?.status).toBe('failed')
    expect([...s.objects.keys()]).toEqual([])
  })

  it('US-10.3 rejects a malformed file and an EXIF orientation other than 1', async () => {
    expect(await (await setup(baseJpeg().subarray(0, 400))).process()).toBe('rejected')
    const s = await setup(jpegWith([jpegExif(6)]))
    expect(await s.process()).toBe('rejected')
    expect(s.objects.has(`originals/${ID}`)).toBe(false)
  })

  it('US-10.8 leaves a capture already processed alone when its failure comes late', async () => {
    const s = await setup(baseJpeg())
    await s.process()
    await failCapture(s.deps)(ID)
    expect(s.rows.get(ID)?.status).toBe('pending_review')
    expect(s.objects.has(`originals/${ID}`)).toBe(true)
  })
})
