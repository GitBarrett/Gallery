import { describe, expect, it, vi } from 'vitest'
import { baseJpeg, HTML } from '../../../../tests/builders/images'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryIdentityRepository } from '../../../../tests/fakes/in-memory-identity-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import type { Actor } from '../../identity'
import { completeAvatarUpload, processAvatar, requestAvatarUpload, serveAvatar } from './avatars'
import type { ModerationGateway } from './ports'

const USER = '0193a000-0000-7000-8000-0000000000a1'
const actor = (more: Partial<Actor> = {}): Actor => ({
  id: USER,
  username: 'Ash',
  role: 'user',
  status: 'active',
  emailVerified: true,
  mfaVerified: false,
  ...more,
})
const square = { contentType: 'image/jpeg', bytes: baseJpeg().length, width: 512, height: 512 }
const sizes = (version: string) => [64, 128, 256].map((s) => `avatars/${USER}/${version}/${s}.webp`)

async function setup(outcome: 'published' | 'pending_review' | 'rejected' = 'published') {
  const clock = { now: () => new Date('2026-11-25T10:00:00Z') }
  const { repo: accounts } = inMemoryIdentityRepository()
  await accounts.createUser({
    id: USER,
    email: 'ash@example.com',
    username: 'Ash',
    passwordHash: null,
    locale: 'en',
    termsAcceptedAt: clock.now(),
    termsVersion: '2026-11-22',
  })
  const { storage, objects } = inMemoryObjectStorage()
  const { uow, sent } = inMemoryUnitOfWork(accounts)
  const { images } = fakeImageService({ format: 'image/jpeg', width: 512, height: 512 })
  const moderate = vi.fn<ModerationGateway>(async () => ({ outcome, score: 0.1 }))
  const purged: string[][] = []
  let n = 0
  const ids = { next: () => `0193a000-0000-7000-8000-00000000000${++n}` }
  const deps = {
    accounts,
    storage,
    images,
    moderate,
    uow,
    purger: { purge: async (u: string[]) => void purged.push(u) },
    siteUrl: 'https://ls.gg',
  }
  // A new avatar put by the browser: request, PUT, complete
  const upload = async (data = baseJpeg()) => {
    const asked = await requestAvatarUpload({ accounts, storage, limiter: inMemoryRateLimiter(clock), ids, clock })({
      actor: actor(),
      file: square,
    })
    if (!asked.ok) throw new Error(JSON.stringify(asked.error))
    objects.set(`incoming/avatars/${USER}/${asked.value.version}`, {
      bytes: data.length,
      contentType: 'image/jpeg',
      data,
    })
    return asked.value.version
  }
  return {
    accounts,
    objects,
    sent,
    moderate,
    purged,
    deps,
    upload,
    process: processAvatar(deps),
    complete: completeAvatarUpload({ accounts, uow, storage }),
  }
}

describe('avatars', () => {
  it('US-07.6 refuses an unverified or suspended member, a file not square or over 2 MB', async () => {
    const s = await setup()
    const clock = { now: () => new Date() }
    const ask = requestAvatarUpload({
      accounts: s.accounts,
      storage: s.deps.storage,
      limiter: inMemoryRateLimiter(clock),
      ids: { next: () => crypto.randomUUID() },
      clock,
    })
    expect(await ask({ actor: actor({ emailVerified: false }), file: square })).toMatchObject({
      error: { reason: 'email_unverified' },
    })
    expect(await ask({ actor: actor({ status: 'suspended' }), file: square })).toMatchObject({
      error: { reason: 'suspended' },
    })
    expect(await ask({ actor: actor(), file: { ...square, height: 400 } })).toMatchObject({
      error: { field: 'file', reason: 'dimensions' },
    })
    expect(await ask({ actor: actor(), file: { ...square, bytes: 2_000_001 } })).toEqual({
      ok: false,
      error: { kind: 'too_large' },
    })
  })

  it('US-07.6 sends the pending version to processing once its object is in the bucket; another version is not found', async () => {
    const s = await setup()
    const version = await s.upload()
    expect(await s.complete({ actor: actor(), version: crypto.randomUUID() })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
    expect(await s.complete({ actor: actor(), version })).toEqual({ ok: true, value: undefined })
    expect(s.sent()).toEqual([{ topic: 'photo-process', payload: { kind: 'avatar', userId: USER, version } }])
  })

  it('US-07.6 publishes a moderated avatar: three square WebP, the old one removed and purged, the author told', async () => {
    const s = await setup('published')
    const first = await s.upload()
    await s.process({ userId: USER, version: first })
    const second = await s.upload()
    expect(await s.accounts.findAvatar(USER)).toEqual({ current: first, pending: second }) // the old one still shown
    expect(await s.process({ userId: USER, version: second })).toBe('processed')
    expect(await s.accounts.findAvatar(USER)).toEqual({ current: second, pending: null })
    expect([...s.objects.keys()].sort()).toEqual(sizes(second).sort())
    expect(s.purged).toEqual([[64, 128, 256].map((w) => `https://ls.gg/avatar/${USER}/${first}/${w}`)])
    expect(s.moderate).toHaveBeenCalledWith(expect.objectContaining({ photoId: second, title: null, target: 'avatar' }))
    expect(s.sent().at(-1)).toEqual({
      topic: 'notifications',
      payload: { type: 'moderation', userId: USER, outcome: 'published' },
    })
    expect(await s.process({ userId: USER, version: second })).toBe('skipped') // replay
  })

  it('US-07.6 keeps the old avatar while the new one is in review; a rejected one is removed and notified', async () => {
    const review = await setup('pending_review')
    const version = await review.upload()
    await review.process({ userId: USER, version })
    expect(await review.accounts.findAvatar(USER)).toEqual({ current: null, pending: version })
    expect(review.sent().at(-1)?.payload).toMatchObject({ outcome: 'pending_review' })

    const rejected = await setup('rejected')
    const refused = await rejected.upload()
    await rejected.process({ userId: USER, version: refused })
    expect(await rejected.accounts.findAvatar(USER)).toEqual({ current: null, pending: null })
    expect([...rejected.objects.keys()]).toEqual([])
    expect(rejected.sent().at(-1)?.payload).toMatchObject({ outcome: 'rejected' })
  })

  it('US-07.6 ends failed a file that is not an image, without moderating it', async () => {
    const s = await setup()
    const version = await s.upload(HTML)
    expect(await s.process({ userId: USER, version })).toBe('rejected')
    expect(s.moderate).not.toHaveBeenCalled()
    expect(await s.accounts.findAvatar(USER)).toEqual({ current: null, pending: null })
    expect(s.sent().at(-1)?.payload).toMatchObject({ outcome: 'failed' })
  })

  it('serves the avatar shown only, at 64, 128 or 256 px', async () => {
    const s = await setup('published')
    const version = await s.upload()
    await s.process({ userId: USER, version })
    const serve = serveAvatar({ accounts: s.accounts, storage: s.deps.storage })
    expect(await new Response((await serve({ userId: USER, version, size: '128' }))!).text()).toBe('128:image/webp:82')
    expect(await serve({ userId: USER, version, size: '512' })).toBeNull()
    expect(await serve({ userId: USER, version: crypto.randomUUID(), size: '128' })).toBeNull()
  })
})
