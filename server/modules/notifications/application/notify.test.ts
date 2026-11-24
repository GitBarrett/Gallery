import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryNotificationsRepository } from '../../../../tests/fakes/in-memory-notifications-repository'
import type { NotificationPrefs } from '../../../../shared/domain/notification-prefs'
import { notify, purgeNotifications } from './notify'

const all: NotificationPrefs = { likes: true, comments: true, followers: true, contests: true }
const [author, ash, tyrande, photoId] = [
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
]

function setup(prefs: NotificationPrefs | null = all) {
  const fake = inMemoryNotificationsRepository()
  const at = (iso: string) => notify({ repo: fake.repo, prefsOf: async () => prefs, clock: fixedClock(iso) })
  return { ...fake, at }
}

describe('notify', () => {
  it('US-35.1 creates a notification for each type of event, with its data', async () => {
    const { rows, at } = setup()
    const run = at('2026-11-24T10:00:00Z')
    await run({ type: 'comment', userId: author, photoId, commentId: tyrande, actorId: ash })
    await run({ type: 'follow', userId: author, actorId: ash })
    await run({ type: 'moderation', userId: author, photoId, outcome: 'rejected' })
    await run({ type: 'quality', userId: author, photoId, quality: 'rare' })
    await run({ type: 'contest', userId: author, contestId: photoId, event: 'opened' })
    await run({ type: 'like', userId: author, photoId, actorId: ash })
    expect(rows.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'comment', payload: { photoId, commentId: tyrande, actorId: ash } },
      { type: 'follow', payload: { actorId: ash } },
      { type: 'moderation', payload: { photoId, outcome: 'rejected' } },
      { type: 'quality', payload: { photoId, quality: 'rare' } },
      { type: 'contest', payload: { contestId: photoId, event: 'opened' } },
      { type: 'like', payload: { photoId, actorIds: [ash] } },
    ])
    expect(rows.every((r) => r.userId === author && r.readAt === null)).toBe(true)
    expect(rows[0]?.createdAt).toEqual(new Date('2026-11-24T10:00:00Z'))
  })

  it('US-35.2 groups the likes on the same capture within an hour into one unread notification', async () => {
    const { rows, at } = setup()
    await at('2026-11-24T10:00:00Z')({ type: 'like', userId: author, photoId, actorId: ash })
    rows[0]!.readAt = new Date('2026-11-24T10:10:00Z')
    await at('2026-11-24T10:59:59Z')({ type: 'like', userId: author, photoId, actorId: tyrande })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ payload: { photoId, actorIds: [ash, tyrande] }, readAt: null })

    await at('2026-11-24T11:00:01Z')({ type: 'like', userId: author, photoId, actorId: ash }) // over an hour
    await at('2026-11-24T11:00:01Z')({ type: 'like', userId: author, photoId: ash, actorId: ash }) // other capture
    expect(rows.map((r) => r.payload.actorIds)).toEqual([[ash, tyrande], [ash], [ash]])
  })

  it('US-35.4 creates nothing for a type the recipient turned off, but always a moderation decision', async () => {
    const { rows, at } = setup({ likes: false, comments: false, followers: false, contests: false })
    const run = at('2026-11-24T10:00:00Z')
    await run({ type: 'like', userId: author, photoId, actorId: ash })
    await run({ type: 'comment', userId: author, photoId, commentId: tyrande, actorId: ash })
    await run({ type: 'follow', userId: author, actorId: ash })
    await run({ type: 'contest', userId: author, contestId: photoId, event: 'results' })
    await run({ type: 'moderation', userId: author, outcome: 'rejected' })
    expect(rows.map((r) => r.type)).toEqual(['moderation'])
  })

  it('creates nothing for a recipient who no longer exists', async () => {
    const { rows, at } = setup(null)
    await at('2026-11-24T10:00:00Z')({ type: 'moderation', userId: author, photoId, outcome: 'published' })
    expect(rows).toEqual([])
  })

  it('US-35.5 purges the notifications over 6 months old', async () => {
    const { repo, rows, at } = setup()
    await at('2026-05-24T03:14:59Z')({ type: 'follow', userId: author, actorId: ash })
    await at('2026-05-24T03:15:00Z')({ type: 'follow', userId: author, actorId: tyrande })
    await purgeNotifications({ repo, clock: fixedClock('2026-11-24T03:15:00Z') })()
    expect(rows.map((r) => r.payload.actorId)).toEqual([tyrande])
  })
})
