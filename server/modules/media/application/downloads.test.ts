import { describe, expect, it } from 'vitest'
import { anActor } from '../../../../tests/builders/actor'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { DOWNLOAD_URL_SECONDS, DOWNLOADS_PER_HOUR, purgeDownloads, requestDownload } from './downloads'
import type { DownloadLog } from './ports'

const ash = anActor({ id: 'u-ash' })
const ID = '0193a000-0000-7000-8000-0000000000p1'

function setup(status = 'published') {
  let t = new Date('2026-11-26T23:30:00Z').getTime()
  const clock = { now: () => new Date(t) }
  const { repo, rows } = inMemoryMediaRepository(clock)
  const { storage, objects } = inMemoryObjectStorage()
  const recorded = new Set<string>()
  const counts = new Map<string, number>()
  const log: DownloadLog = {
    async record(userId, photoId, day) {
      const key = `${userId}|${photoId}|${day}`
      if (recorded.has(key)) return false
      recorded.add(key)
      counts.set(photoId, (counts.get(photoId) ?? 0) + 1)
      return true
    },
    async purgeBefore(day) {
      const old = [...recorded].filter((key) => key.split('|')[2]! < day)
      for (const key of old) recorded.delete(key)
      return old.length
    },
  }
  const download = requestDownload({ repo, storage, downloads: log, limiter: inMemoryRateLimiter(clock), clock })
  const capture = async (id = ID) => {
    await repo.createUpload({ id, userId: 'u-author', mime: 'image/png', bytes: 10, width: 1920, height: 1080 })
    rows.get(id)!.status = status
    objects.set(`originals/${id}`, { bytes: 10, contentType: 'image/webp' }) // converted by the processing (Q18)
    return id
  }
  return { download, capture, counts, recorded, log, clock, objects, advance: (ms: number) => (t += ms) }
}

describe('requestDownload', () => {
  it('US-23.1 gives a presigned GET of the cleaned original for 5 min, as an attachment of its stored type', async () => {
    const s = setup()
    const id = await s.capture()
    const result = await s.download({ actor: ash, photoId: id })
    if (!result.ok) throw new Error('refused')
    const url = new URL(result.value.url)
    expect(url.pathname).toBe(`/originals/${id}`)
    expect(url.searchParams.get('X-Amz-Expires')).toBe(String(DOWNLOAD_URL_SECONDS))
    expect(DOWNLOAD_URL_SECONDS).toBe(300)
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename="legendary-shots-${id}.webp"`,
    )
    expect(url.searchParams.get('response-content-type')).toBe('image/webp')
    expect(result.value.expiresAt).toEqual(new Date(s.clock.now().getTime() + 300_000))
  })

  it('US-23.1 counts a download once per member, capture and UTC day', async () => {
    const s = setup()
    const id = await s.capture()
    await s.download({ actor: ash, photoId: id })
    await s.download({ actor: ash, photoId: id })
    expect(s.counts.get(id)).toBe(1)
    await s.download({ actor: anActor({ id: 'u-brook' }), photoId: id })
    expect(s.counts.get(id)).toBe(2)
    s.advance(60 * 60_000) // 00:30 UTC the next day
    await s.download({ actor: ash, photoId: id })
    expect(s.counts.get(id)).toBe(3)
    expect([...s.recorded]).toContain(`u-ash|${id}|2026-11-27`)
  })

  it('US-23.1 lets any member download, even unverified or suspended, the author too (annexe B)', async () => {
    const s = setup()
    const id = await s.capture()
    for (const actor of [
      anActor({ id: 'u-new', emailVerified: false }),
      anActor({ id: 'u-suspended', status: 'suspended' }),
      anActor({ id: 'u-author' }),
    ])
      expect((await s.download({ actor, photoId: id })).ok).toBe(true)
  })

  it('does not find a capture that is not published, missing, or without its original', async () => {
    for (const status of ['processing', 'pending_review', 'hidden', 'rejected']) {
      const s = setup(status)
      const id = await s.capture()
      expect(await s.download({ actor: anActor({ id: 'u-author' }), photoId: id })).toEqual({
        ok: false,
        error: { kind: 'not_found' },
      })
      expect(s.counts.get(id)).toBeUndefined()
    }
    const s = setup()
    expect(await s.download({ actor: ash, photoId: 'missing' })).toEqual({ ok: false, error: { kind: 'not_found' } })
    const id = await s.capture()
    s.objects.delete(`originals/${id}`)
    expect(await s.download({ actor: ash, photoId: id })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(s.counts.get(id)).toBeUndefined()
  })

  it('US-23.3 refuses the 101st download of an account within the hour, then allows it again', async () => {
    const s = setup()
    expect(DOWNLOADS_PER_HOUR).toEqual({ name: 'downloads', limit: 100, windowSeconds: 3600 })
    const id = await s.capture()
    for (let n = 0; n < 100; n++) expect((await s.download({ actor: ash, photoId: id })).ok).toBe(true)
    const refused = await s.download({ actor: ash, photoId: id })
    expect(refused).toEqual({ ok: false, error: { kind: 'rate_limited', retryAfterSeconds: expect.any(Number) } })
    expect((await s.download({ actor: anActor({ id: 'u-brook' }), photoId: id })).ok).toBe(true) // per account
    s.advance(60 * 60_000)
    expect((await s.download({ actor: ash, photoId: id })).ok).toBe(true)
  })
})

describe('purgeDownloads', () => {
  it('deletes the downloads older than 30 days, the counters stay', async () => {
    const s = setup()
    await s.log.record('u-ash', ID, '2026-10-26')
    await s.log.record('u-ash', ID, '2026-10-27')
    expect(await purgeDownloads({ downloads: s.log, clock: s.clock })()).toBe(1)
    expect([...s.recorded]).toEqual([`u-ash|${ID}|2026-10-27`])
    expect(s.counts.get(ID)).toBe(2)
  })
})
