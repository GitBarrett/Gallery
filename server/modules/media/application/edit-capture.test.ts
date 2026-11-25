import { describe, expect, it } from 'vitest'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { anActor } from '../../../../tests/builders/actor'
import type { Actor } from '../../identity'
import { deleteCapture, editCapture } from './edit-capture'

const actor = (id: string, more: Partial<Actor> = {}) => anActor({ id, username: id, ...more })
const [ash, jaina] = [actor('u-ash'), actor('u-jaina')]
const ID = '0193a000-0000-7000-8000-0000000000aa'
const NAMES = ['1200.jpg', '400.webp', '800.webp', '1200.webp', '2400.webp']

async function setup(status = 'published') {
  const at = new Date('2026-11-25T10:00:00Z')
  const { repo, rows, edits } = inMemoryMediaRepository({ now: () => at })
  const { storage, objects } = inMemoryObjectStorage()
  await repo.createUpload({ id: ID, userId: ash.id, mime: 'image/png', bytes: 4, width: 1920, height: 1080 })
  await repo.complete(ID, { title: 'Dusk', gameVersion: 'wow-forever', at })
  rows.get(ID)!.status = status
  const put = (key: string) => objects.set(key, { bytes: 1, contentType: 'image/webp', data: new Uint8Array([1]) })
  put(`originals/${ID}`)
  for (const name of NAMES) put(`variants/${ID}/${name}`)
  const purged: string[][] = []
  const edit = editCapture({
    repo,
    zoneOf: async (slug) => (slug === 'stormwind' ? 'zone-1' : null),
    tagIdsOf: async (slugs) => slugs.map((slug) => `tag-${slug}`),
  })
  const remove = deleteCapture({
    repo,
    storage,
    purger: { purge: async (urls) => void purged.push(urls) },
    siteUrl: 'https://ls.gg',
  })
  return { rows, edits, objects, purged, edit, remove }
}

describe('editCapture', () => {
  it('US-12.1 US-13.1 changes only the fields sent, without a new moderation; empty or null clears', async () => {
    const s = await setup('published')
    const result = await s.edit({
      actor: ash,
      photoId: ID,
      title: 'Dawn',
      description: '',
      caption: 'First light.',
      zone: 'stormwind',
      tags: ['Aube', 'aube'],
      focalX: 0.3,
      focalY: 0.6,
    })
    expect(result).toEqual({ ok: true, value: undefined })
    expect(s.edits.get(ID)).toEqual({
      title: 'Dawn',
      description: null,
      focalX: 0.3,
      focalY: 0.6,
      metadata: { caption: 'First light.', zoneId: 'zone-1', zoneCustom: null },
      tagIds: ['tag-aube'],
    })
    expect(s.rows.get(ID)).toMatchObject({ title: 'Dawn', status: 'published' })
    await s.edit({ actor: ash, photoId: ID, zone: null, focalX: null, focalY: null, inGameTime: '' })
    expect(s.edits.get(ID)).toMatchObject({
      focalX: null,
      metadata: { zoneId: null, zoneCustom: null, inGameTime: null },
    })
  })

  it('US-12.1 passes the insult filter again and refuses an unknown zone, changing nothing', async () => {
    const s = await setup()
    expect(await s.edit({ actor: ash, photoId: ID, title: 'Quel connard' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'title', reason: 'insult' },
    })
    expect(await s.edit({ actor: ash, photoId: ID, zone: 'atlantis' })).toMatchObject({ error: { field: 'zone' } })
    expect(s.edits.has(ID)).toBe(false)
  })

  it("US-12.3 refuses another member's capture: 403 published, 404 otherwise; a moderator goes through moderation", async () => {
    const published = await setup('published')
    expect(await published.edit({ actor: jaina, photoId: ID, title: 'Mine' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'owner' },
    })
    expect((await published.edit({ actor: actor('u-mod', { role: 'moderator' }), photoId: ID, title: 'X' })).ok).toBe(
      false,
    )
    const review = await setup('pending_review')
    expect(await review.edit({ actor: jaina, photoId: ID, title: 'Mine' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
    expect(await review.edit({ actor: ash, photoId: crypto.randomUUID(), title: 'X' })).toMatchObject({
      error: { kind: 'not_found' },
    })
    expect(published.edits.has(ID)).toBe(false)
  })

  it('refuses an unverified or a suspended author', async () => {
    const s = await setup()
    expect(await s.edit({ actor: actor('u-ash', { emailVerified: false }), photoId: ID, title: 'X' })).toMatchObject({
      error: { reason: 'email_unverified' },
    })
    expect(await s.edit({ actor: actor('u-ash', { status: 'suspended' }), photoId: ID, title: 'X' })).toMatchObject({
      error: { reason: 'suspended' },
    })
  })
})

describe('deleteCapture', () => {
  it('US-12.2 moves the original and the variants to trash/, purges the 5 public addresses, then deletes the row', async () => {
    const s = await setup()
    expect(await s.remove({ actor: ash, photoId: ID })).toEqual({ ok: true, value: undefined })
    expect([...s.objects.keys()].sort()).toEqual(
      [`trash/originals/${ID}`, ...NAMES.map((n) => `trash/variants/${ID}/${n}`)].sort(),
    )
    expect(s.purged).toEqual([['400', '800', '1200', '2400', 'og.jpg'].map((w) => `https://ls.gg/img/${ID}/${w}`)])
    expect(s.rows.has(ID)).toBe(false)
    expect(await s.remove({ actor: ash, photoId: ID })).toEqual({ ok: false, error: { kind: 'not_found' } }) // again
  })

  it('US-12.2 lets a suspended author delete; refuses an unverified one and a capture still processing (409)', async () => {
    const suspended = await setup()
    expect((await suspended.remove({ actor: actor('u-ash', { status: 'suspended' }), photoId: ID })).ok).toBe(true)
    const unverified = await setup()
    expect(await unverified.remove({ actor: actor('u-ash', { emailVerified: false }), photoId: ID })).toMatchObject({
      error: { reason: 'email_unverified' },
    })
    const processing = await setup('processing')
    expect(await processing.remove({ actor: ash, photoId: ID })).toEqual({ ok: false, error: { kind: 'busy' } })
    expect(processing.rows.has(ID)).toBe(true)
  })

  it("US-12.3 refuses another member's capture and leaves its objects", async () => {
    const s = await setup('published')
    expect(await s.remove({ actor: jaina, photoId: ID })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'owner' },
    })
    const hidden = await setup('hidden')
    expect(await hidden.remove({ actor: jaina, photoId: ID })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(s.objects.has(`originals/${ID}`)).toBe(true)
    expect(s.rows.has(ID)).toBe(true)
  })
})
