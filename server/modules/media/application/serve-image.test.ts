import { describe, expect, it } from 'vitest'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { IMAGE_SIZES, removeImages, serveImage } from './serve-image'

const ID = '0193a000-0000-7000-8000-0000000000aa'
type Viewer = Parameters<ReturnType<typeof serveImage>>[0]['viewer']
const owner: Viewer = { id: 'u-ash', role: 'user', mfaVerified: false }
const member: Viewer = { id: 'u-jaina', role: 'user', mfaVerified: false }
const moderator = { id: 'u-mod', role: 'moderator' as const, mfaVerified: true }
const bytes = (text: string) => new TextEncoder().encode(text)

async function setup(status: string) {
  const clock = { now: () => new Date('2026-11-25T10:00:00Z') }
  const { repo, rows } = inMemoryMediaRepository(clock)
  const { storage, objects } = inMemoryObjectStorage()
  await repo.createUpload({ id: ID, userId: 'u-ash', mime: 'image/png', bytes: 10, width: 1920, height: 1080 })
  rows.get(ID)!.status = status
  for (const name of new Set(Object.values(IMAGE_SIZES)))
    objects.set(`variants/${ID}/${name}`, { bytes: name.length, contentType: 'image/webp', data: bytes(name) })
  const serve = (size: string, viewer: Viewer = null, preview = false) =>
    serveImage({ repo, storage })({ photoId: ID, size, preview, viewer })
  return { serve, storage, objects }
}
const text = async (result: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['serve']>>) =>
  result.ok ? new Response(result.value.body).text() : null

describe('serveImage', () => {
  it('US-68.3 serves the stored WebP of each width and the og:image JPEG of a published capture to anyone', async () => {
    const { serve } = await setup('published')
    for (const width of ['400', '800', '1200', '2400']) {
      const served = await serve(width)
      expect(served).toMatchObject({ ok: true, value: { contentType: 'image/webp', public: true } })
      expect(await text(served)).toBe(`${width}.webp`)
    }
    const og = await serve('og.jpg')
    expect(og).toMatchObject({ ok: true, value: { contentType: 'image/jpeg', public: true } })
    expect(await text(og)).toBe('1200.jpg')
  })

  it.each(['401', '64', '1200.jpg', 'original', 'toString', ''])(
    'US-68.3 answers 404 for the size « %s »',
    async (size) => {
      const { serve } = await setup('published')
      expect(await serve(size)).toEqual({ ok: false, error: { kind: 'not_found' } })
    },
  )

  it.each(['processing', 'pending_review', 'rejected', 'failed', 'hidden'])(
    'US-14.4 a %s capture: 404 to a visitor, a member and without ?preview=1; private preview to its author and a moderator',
    async (status) => {
      const { serve } = await setup(status)
      expect((await serve('800')).ok).toBe(false)
      expect((await serve('800', member, true)).ok).toBe(false)
      expect((await serve('800', owner, false)).ok).toBe(false)
      expect((await serve('800', { ...moderator, mfaVerified: false }, true)).ok).toBe(false) // before the TOTP
      expect(await serve('800', owner, true)).toMatchObject({ ok: true, value: { public: false } })
      expect(await serve('800', moderator, true)).toMatchObject({ ok: true, value: { public: false } })
    },
  )

  it('answers 404 for an unknown capture and a missing variant', async () => {
    const { serve, objects } = await setup('published')
    objects.delete(`variants/${ID}/800.webp`)
    expect((await serve('800')).ok).toBe(false)
    const { repo } = inMemoryMediaRepository({ now: () => new Date() })
    const { storage } = inMemoryObjectStorage()
    expect((await serveImage({ repo, storage })({ photoId: ID, size: '800', preview: false, viewer: null })).ok).toBe(
      false,
    )
  })
})

describe('removeImages', () => {
  it('moves the variants to trash/ and purges the 5 public addresses; a hidden capture stays previewable', async () => {
    const { serve, storage, objects } = await setup('hidden')
    const purged: string[][] = []
    await removeImages({
      storage,
      purger: { purge: async (urls) => void purged.push(urls) },
      siteUrl: 'https://ls.gg',
    })(ID)
    expect([...objects.keys()].sort()).toEqual(
      ['1200.jpg', '1200.webp', '2400.webp', '400.webp', '800.webp'].map((n) => `trash/variants/${ID}/${n}`),
    )
    expect(purged).toEqual([['400', '800', '1200', '2400', 'og.jpg'].map((s) => `https://ls.gg/img/${ID}/${s}`)])
    expect(await text(await serve('800', owner, true))).toBe('800.webp')
  })
})
