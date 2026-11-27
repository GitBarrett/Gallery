import { describe, expect, it } from 'vitest'
import { anActor } from '../../../../tests/builders/actor'
import { inMemoryLikesRepository } from '../../../../tests/fakes/in-memory-likes-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { LIKES_PER_HOUR, likePhoto, unlikePhoto, viewLike } from './likes'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const AUTHOR = '0193a000-0000-7000-8000-00000000aa01'
const ash = anActor({ id: '0193a000-0000-7000-8000-00000000aa02' })
const P = '0193a000-0000-7000-8000-00000000bb01'

function setup(captures: Parameters<typeof inMemoryLikesRepository>[0] = { [P]: { authorId: AUTHOR } }) {
  let t = new Date('2026-11-26T10:00:00Z').getTime()
  const clock = { now: () => new Date(t) }
  const store = inMemoryLikesRepository(captures)
  const { uow, sent } = inMemoryUnitOfWork(store.repo)
  const deps = { uow, limiter: inMemoryRateLimiter(clock), thresholds: async () => thresholds }
  return { ...store, sent, like: likePhoto(deps), unlike: unlikePhoto(deps), advance: (ms: number) => (t += ms) }
}

describe('likePhoto', () => {
  it('US-30.1 counts the like once, then the second action removes it', async () => {
    const s = setup()
    expect(await s.like({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: true, likes: 1 } })
    expect(await s.like({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: true, likes: 1 } })
    expect(await s.unlike({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: false, likes: 0 } })
    expect(await s.unlike({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: false, likes: 0 } })
  })

  it('US-30.1 tells the author of a new like, not of a like already there', async () => {
    const s = setup()
    await s.like({ actor: ash, photoId: P })
    await s.like({ actor: ash, photoId: P })
    expect(s.sent()).toEqual([
      { topic: 'notifications', payload: { type: 'like', userId: AUTHOR, photoId: P, actorId: ash.id } },
    ])
  })

  it('US-30.2 refuses a like on their own capture (403)', async () => {
    const s = setup()
    const author = anActor({ id: AUTHOR })
    expect(await s.like({ actor: author, photoId: P })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'owner' },
    })
    expect(s.counts.get(P)).toBe(0)
  })

  it('US-08.2 lets an unverified member like; a suspended one may not', async () => {
    const s = setup()
    expect((await s.like({ actor: anActor({ id: 'u-new', emailVerified: false }), photoId: P })).ok).toBe(true)
    expect(await s.like({ actor: anActor({ id: 'u-out', status: 'suspended' }), photoId: P })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'suspended' },
    })
  })

  it('does not find a capture that is not public, nor a missing one', async () => {
    const s = setup({ [P]: { authorId: AUTHOR, public: false } })
    expect(await s.like({ actor: ash, photoId: P })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(await s.unlike({ actor: ash, photoId: P })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(await s.like({ actor: ash, photoId: 'missing' })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })

  it('US-30.5 refuses the 121st like of an account within the hour (429), not an unlike', async () => {
    expect(LIKES_PER_HOUR).toEqual({ name: 'likes', limit: 120, windowSeconds: 3600 })
    const captures = Object.fromEntries(Array.from({ length: 121 }, (_, n) => [`p${n}`, { authorId: AUTHOR }]))
    const s = setup(captures)
    for (let n = 0; n < 120; n++) expect((await s.like({ actor: ash, photoId: `p${n}` })).ok).toBe(true)
    expect(await s.like({ actor: ash, photoId: 'p120' })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: expect.any(Number) },
    })
    expect((await s.unlike({ actor: ash, photoId: 'p0' })).ok).toBe(true)
    s.advance(3600_000)
    expect((await s.like({ actor: ash, photoId: 'p120' })).ok).toBe(true)
  })

  it('US-30.6 US-71.4 tells the author once when a like reaches a tier, even liked again after an unlike', async () => {
    const s = setup({ [P]: { authorId: AUTHOR, likes: 2 } })
    await s.like({ actor: ash, photoId: P }) // 3: Uncommon
    await s.unlike({ actor: ash, photoId: P })
    await s.like({ actor: ash, photoId: P }) // 3 again: told already
    const quality = s.sent().filter((m) => m.payload.type === 'quality')
    expect(quality).toEqual([
      { topic: 'notifications', payload: { type: 'quality', userId: AUTHOR, photoId: P, quality: 'uncommon' } },
    ])
    expect(s.told.get(P)).toBe(1)
  })

  it('US-30.1 tells the member whether they like a public capture, with its counter', async () => {
    const s = setup({ [P]: { authorId: AUTHOR, likes: 4 }, hidden: { authorId: AUTHOR, public: false } })
    const view = viewLike({ repo: s.repo })
    expect(await view({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: false, likes: 4 } })
    await s.like({ actor: ash, photoId: P })
    expect(await view({ actor: ash, photoId: P })).toEqual({ ok: true, value: { liked: true, likes: 5 } })
    expect(await view({ actor: ash, photoId: 'hidden' })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })

  it('US-71.4 tells nothing below the first tier', async () => {
    const s = setup()
    await s.like({ actor: ash, photoId: P })
    expect(s.sent().map((m) => m.payload.type)).toEqual(['like'])
  })
})
