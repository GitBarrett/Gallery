import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../../../tests/fakes/fixed-clock'
import { inMemoryNotificationsRepository } from '../../../../tests/fakes/in-memory-notifications-repository'
import { listNotifications, markAllRead, markRead, unreadCount } from './read-notifications'

const id = (): string => crypto.randomUUID()
const [me, ash, jaina, gone, photo, lostPhoto] = [id(), id(), id(), id(), id(), id()]
const names = new Map([
  [ash, 'Ash'],
  [jaina, 'Jaina'],
])
const titles = new Map<string, string | null>([[photo, 'Dawn on the Plains']])

function setup() {
  const fake = inMemoryNotificationsRepository()
  const add = (type: 'like' | 'comment' | 'follow' | 'moderation' | 'quality', payload: object, at: string) =>
    fake.repo.create({ userId: me, type, payload: payload as Record<string, unknown>, createdAt: new Date(at) })
  const deps = {
    repo: fake.repo,
    usernames: async (ids: string[]) => new Map(ids.filter((id) => names.has(id)).map((id) => [id, names.get(id)!])),
    titles: async (ids: string[]) =>
      new Map(ids.filter((id) => titles.has(id)).map((id) => [id, titles.get(id) ?? null])),
    clock: fixedClock('2026-11-24T12:00:00Z'),
  }
  return { ...fake, add, deps }
}

describe('Quest log', () => {
  it('US-35.3 lists the latest first with the usernames and titles read now, and their read state', async () => {
    const { add, deps, rows } = setup()
    await add('follow', { actorId: ash }, '2026-11-24T09:00:00Z')
    await add('like', { photoId: photo, actorIds: [gone, ash, jaina] }, '2026-11-24T10:00:00Z')
    await add('moderation', { outcome: 'rejected' }, '2026-11-24T10:30:00Z') // the avatar (US-07.6)
    await add('quality', { photoId: photo, quality: 'rare' }, '2026-11-24T11:00:00Z')
    rows[0]!.readAt = new Date('2026-11-24T09:30:00Z')

    expect(await listNotifications(deps)({ userId: me })).toEqual([
      expect.objectContaining({
        type: 'quality',
        read: false,
        actor: null,
        photoTitle: 'Dawn on the Plains',
        detail: 'rare',
      }),
      expect.objectContaining({ type: 'moderation', actor: null, photoId: null, photoTitle: null, detail: 'rejected' }),
      // US-35.2: the latest liker and the others, a deleted account no longer counted
      expect.objectContaining({ type: 'like', actor: 'Jaina', others: 1, photoId: photo, detail: null }),
      {
        id: rows[0]!.id,
        type: 'follow',
        read: true,
        createdAt: '2026-11-24T09:00:00.000Z',
        actor: 'Ash',
        others: 0,
        photoId: null,
        photoTitle: null,
        detail: null,
      },
    ])
  })

  it('US-35.3 leaves out an entry whose member or capture is gone (Q69)', async () => {
    const { add, deps } = setup()
    await add('follow', { actorId: gone }, '2026-11-24T09:00:00Z')
    await add('comment', { photoId: photo, commentId: crypto.randomUUID(), actorId: gone }, '2026-11-24T09:10:00Z')
    await add('like', { photoId: lostPhoto, actorIds: [ash] }, '2026-11-24T09:20:00Z')
    await add('moderation', { photoId: lostPhoto, outcome: 'published' }, '2026-11-24T09:30:00Z')
    expect(await listNotifications(deps)({ userId: me })).toEqual([])
  })

  it('US-35.1 counts the unread for the bell; US-35.3 marks one of its own, then all, as read', async () => {
    const { add, deps, rows } = setup()
    await add('follow', { actorId: ash }, '2026-11-24T09:00:00Z')
    await add('follow', { actorId: jaina }, '2026-11-24T09:10:00Z')
    expect(await unreadCount(deps)({ userId: me })).toBe(2)

    expect(await markRead(deps)({ userId: ash, id: rows[0]!.id })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(await markRead(deps)({ userId: me, id: rows[0]!.id })).toEqual({ ok: true, value: undefined })
    expect(rows[0]!.readAt).toEqual(new Date('2026-11-24T12:00:00Z'))
    expect(await unreadCount(deps)({ userId: me })).toBe(1)

    await markAllRead(deps)({ userId: me })
    expect(await unreadCount(deps)({ userId: me })).toBe(0)
  })
})
