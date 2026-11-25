import { describe, expect, it } from 'vitest'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import type { Actor } from '../../identity'
import { completeUpload, purgeOrphanUploads, requestUploadUrl } from './uploads'

const ash: Actor = {
  id: 'u-ash',
  username: 'Ash',
  role: 'user',
  status: 'active',
  emailVerified: true,
  mfaVerified: false,
}
const file = { contentType: 'image/png', bytes: 5_000_000, width: 1920, height: 1080 }
const MIN = 60_000

function setup() {
  let t = new Date('2026-11-24T10:00:00Z').getTime()
  const clock = { now: () => new Date(t) }
  const { repo, rows, captureDetails } = inMemoryMediaRepository(clock)
  const { storage, objects } = inMemoryObjectStorage()
  const { uow, sent } = inMemoryUnitOfWork(repo)
  let n = 0
  const ids = { next: () => `0193-${++n}` }
  const request = requestUploadUrl({ repo, storage, limiter: inMemoryRateLimiter(clock), ids, clock })
  const complete = completeUpload({
    repo,
    uow,
    storage,
    gameVersions: async () => [{ slug: 'wow-forever' }],
    zoneOf: async (slug) => (slug === 'stormwind-city' ? 'zone-1' : null),
    tagIdsOf: async (slugs) => slugs.map((slug) => 'tag-' + slug),
    clock,
  })
  // The browser's PUT through the presigned URL
  const put = (photoId: string, object = { bytes: file.bytes, contentType: file.contentType }) =>
    objects.set(`incoming/${photoId}`, object)
  const advance = (ms: number) => (t += ms)
  return { request, complete, put, advance, rows, objects, sent, repo, storage, clock, captureDetails }
}

const upload = async (s: ReturnType<typeof setup>, actor = ash) => {
  const result = await s.request({ actor, file })
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.error)}`)
  return result.value.photoId
}

describe('upload request', () => {
  it('US-10.1 creates the capture processing and gives a presigned PUT of incoming/{id}, valid 10 min', async () => {
    const s = setup()
    const result = await s.request({ actor: ash, file })
    expect(result).toMatchObject({
      ok: true,
      value: { photoId: '0193-1', expiresAt: new Date('2026-11-24T10:10:00Z') },
    })
    const url = new URL((result as { value: { url: string } }).value.url)
    expect(url.pathname).toBe('/incoming/0193-1')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(s.rows.get('0193-1')).toMatchObject({ userId: 'u-ash', mime: 'image/png', bytes: 5_000_000 })
  })

  it('US-10.2 refuses again on the server a file out of the rules, with its reason', async () => {
    const s = setup()
    expect(await s.request({ actor: ash, file: { ...file, contentType: 'image/gif' } })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'file', reason: 'type' },
    })
    expect(await s.request({ actor: ash, file: { ...file, width: 600, height: 400 } })).toMatchObject({
      error: { reason: 'dimensions' },
    })
    expect(await s.request({ actor: ash, file: { ...file, bytes: 20_000_001 } })).toEqual({
      ok: false,
      error: { kind: 'too_large' },
    })
    expect(s.rows.size).toBe(0)
  })

  it('US-08.1 refuses an unverified member, and a suspended one', async () => {
    const s = setup()
    expect(await s.request({ actor: { ...ash, emailVerified: false }, file })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'email_unverified' },
    })
    expect(await s.request({ actor: { ...ash, status: 'suspended' }, file })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'suspended' },
    })
  })

  it('US-10.5 refuses the 21st upload of 24 h with the delay until it is unblocked', async () => {
    const s = setup()
    for (let i = 0; i < 20; i++) {
      const photoId = await upload(s)
      s.put(photoId)
      await s.complete({ actor: ash, photoId, title: 'Dusk', gameVersion: 'wow-forever' }) // so not concurrent
    }
    // 10:00 UTC: the fixed day window ends at midnight UTC, 14 h later
    expect(await s.request({ actor: ash, file })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: 14 * 3600 },
    })
  })

  it('US-10.5 allows 3 uploads at once, a 4th once the oldest URL expired', async () => {
    const s = setup()
    for (let i = 0; i < 3; i++) await upload(s)
    expect(await s.request({ actor: ash, file })).toMatchObject({ ok: false, error: { kind: 'rate_limited' } })
    s.advance(10 * MIN + 1)
    expect((await s.request({ actor: ash, file })).ok).toBe(true)
  })
})

describe('upload completion', () => {
  it('US-10.1 completes the capture with its title and version, then sends it to processing once', async () => {
    const s = setup()
    const photoId = await upload(s)
    s.put(photoId)
    const cmd = { actor: ash, photoId, title: 'Dusk over Elwynn', gameVersion: 'wow-forever' }
    expect(await s.complete(cmd)).toEqual({ ok: true, value: { photoId, status: 'processing' } })
    expect(await s.complete(cmd)).toEqual({ ok: true, value: { photoId, status: 'processing' } }) // double click
    expect(s.sent()).toEqual([{ topic: 'photo-process', payload: { kind: 'capture', photoId } }])
    expect(s.rows.get(photoId)).toMatchObject({ title: 'Dusk over Elwynn', gameVersion: 'wow-forever' })
  })

  it('US-10.6 deletes an object of another size or type than declared and answers the mismatch', async () => {
    const s = setup()
    const sized = await upload(s)
    s.put(sized, { bytes: file.bytes + 1, contentType: 'image/png' })
    const typed = await upload(s)
    s.put(typed, { bytes: file.bytes, contentType: 'text/html' })
    for (const [photoId, reason] of [
      [sized, 'size'],
      [typed, 'type'],
    ] as const) {
      expect(await s.complete({ actor: ash, photoId, title: 'Dusk', gameVersion: 'wow-forever' })).toEqual({
        ok: false,
        error: { kind: 'mismatch', reason },
      })
      expect(s.objects.has(`incoming/${photoId}`)).toBe(false)
    }
    expect(s.sent()).toEqual([])
  })

  it('US-10.6 answers the mismatch when nothing was put (expired URL)', async () => {
    const s = setup()
    const photoId = await upload(s)
    expect(await s.complete({ actor: ash, photoId, title: 'Dusk', gameVersion: 'wow-forever' })).toEqual({
      ok: false,
      error: { kind: 'mismatch', reason: 'missing' },
    })
  })

  it("US-10.1 refuses an unknown game version, and hides another member's capture", async () => {
    const s = setup()
    const photoId = await upload(s)
    s.put(photoId)
    expect(await s.complete({ actor: ash, photoId, title: 'Dusk', gameVersion: 'retail' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'gameVersion', reason: 'unknown' },
    })
    const misty = { ...ash, id: 'u-misty' }
    expect(await s.complete({ actor: misty, photoId, title: 'Dusk', gameVersion: 'wow-forever' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
    expect(await s.complete({ actor: ash, photoId: 'nope', title: 'Dusk', gameVersion: 'wow-forever' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
  })

  it('US-08.1 refuses an unverified member', async () => {
    const s = setup()
    const photoId = await upload(s)
    expect(
      await s.complete({ actor: { ...ash, emailVerified: false }, photoId, title: 'Dusk', gameVersion: 'wow-forever' }),
    ).toMatchObject({ ok: false, error: { reason: 'email_unverified' } })
  })
})

describe('upload details', () => {
  const completed = async (body: Record<string, unknown>) => {
    const s = setup()
    const photoId = await upload(s)
    s.put(photoId)
    const result = await s.complete({ actor: ash, photoId, title: 'Dusk', gameVersion: 'wow-forever', ...body })
    return { s, photoId, result }
  }

  it('US-11.1 US-11.2 stores the details with the completion, zone and normalised tags resolved', async () => {
    const { s, photoId, result } = await completed({
      description: ' Long story ',
      altText: 'The canals of Suramar at night',
      caption: 'The canals glow brighter tonight.',
      zone: 'stormwind-city',
      inGameTime: '23:40',
      graphicsSettings: 'Ultra, ray tracing',
      characterName: 'Lunelame',
      tags: ['Nuit', 'NUIT', 'Ciel étoilé'],
    })
    expect(result.ok).toBe(true)
    expect(s.captureDetails.get(photoId)).toEqual({
      description: 'Long story',
      altText: 'The canals of Suramar at night',
      caption: 'The canals glow brighter tonight.',
      zoneId: 'zone-1',
      zoneCustom: undefined,
      inGameTime: '23:40',
      graphicsSettings: 'Ultra, ray tracing',
      characterName: 'Lunelame',
      tagIds: ['tag-nuit', 'tag-ciel etoile'],
    })
  })

  it('US-13.1 stores the focal point chosen by the author; US-13.2 none means the centre', async () => {
    const { s, photoId } = await completed({ focalX: 0.25, focalY: 0.8 })
    expect(s.captureDetails.get(photoId)).toMatchObject({ focalX: 0.25, focalY: 0.8 })
    const centre = await completed({})
    expect(centre.s.captureDetails.get(centre.photoId)).toMatchObject({ focalX: undefined, focalY: undefined })
  })

  it('US-11.3 keeps a zone typed freely, out of the dictionary', async () => {
    const { s, photoId } = await completed({ zoneCustom: 'Hidden Glade' })
    expect(s.captureDetails.get(photoId)).toMatchObject({ zoneId: undefined, zoneCustom: 'Hidden Glade', tagIds: [] })
  })

  it('US-11.5 US-11.1 US-11.2 refuses an insult, a bad tag or an unknown zone, before completing', async () => {
    for (const [body, error] of [
      [{ title: 'Quel connard' }, { field: 'title', reason: 'insult' }],
      [{ caption: 'salope' }, { field: 'caption', reason: 'insult' }],
      [{ tags: ['x'] }, { field: 'tags', reason: 'length' }],
      [{ zone: 'atlantis' }, { field: 'zone', reason: 'unknown' }],
    ] as const) {
      const { s, photoId, result } = await completed(body)
      expect(result).toEqual({ ok: false, error: { kind: 'invalid', ...error } })
      expect(s.rows.get(photoId)?.uploadedAt).toBeNull()
      expect(s.sent()).toEqual([])
    }
  })
})

describe('orphan uploads', () => {
  it('US-10.7 deletes the capture and the object of an upload never completed after 24 h, not before', async () => {
    const s = setup()
    const purge = purgeOrphanUploads({ repo: s.repo, storage: s.storage, clock: s.clock })
    const orphan = await upload(s)
    s.put(orphan)
    const completed = await upload(s)
    s.put(completed)
    await s.complete({ actor: ash, photoId: completed, title: 'Dusk', gameVersion: 'wow-forever' })
    s.advance(24 * 60 * MIN - 1)
    expect(await purge()).toBe(0)
    s.advance(2)
    expect(await purge()).toBe(1)
    expect([...s.rows.keys()]).toEqual([completed])
    expect([...s.objects.keys()]).toEqual([`incoming/${completed}`])
  })
})
