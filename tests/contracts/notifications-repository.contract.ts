import { describe, expect, it } from 'vitest'
import type { NotificationsRepository } from '../../server/modules/notifications'

// Contract of the NotificationsRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `make` returns the repository and a recipient that exists (a user row for the database).
export function notificationsRepositoryContract(
  name: string,
  make: () => Promise<{ repo: NotificationsRepository; userId: string }>,
) {
  describe(`NotificationsRepository contract: ${name}`, () => {
    const photoId = crypto.randomUUID()
    const like = (userId: string, createdAt: string, actorIds: string[], photo = photoId) => ({
      userId,
      type: 'like' as const,
      payload: { photoId: photo, actorIds },
      createdAt: new Date(createdAt),
    })

    it('US-35.2 finds the latest like notification of a capture created since a date, and only that one', async () => {
      const { repo, userId } = await make()
      const [ash, tyrande] = [crypto.randomUUID(), crypto.randomUUID()]
      await repo.create(like(userId, '2026-11-24T09:00:00Z', [ash]))
      await repo.create(like(userId, '2026-11-24T11:00:00Z', [tyrande]))
      await repo.create(like(userId, '2026-11-24T11:30:00Z', [ash], crypto.randomUUID()))
      await repo.create({
        userId,
        type: 'follow',
        payload: { actorId: ash },
        createdAt: new Date('2026-11-24T11:40:00Z'),
      })
      const group = await repo.findLikeGroup(userId, photoId, new Date('2026-11-24T10:45:00Z'))
      expect(group?.actorIds).toEqual([tyrande])
      expect(await repo.findLikeGroup(userId, photoId, new Date('2026-11-24T11:00:01Z'))).toBeNull()
      expect(await repo.findLikeGroup(crypto.randomUUID(), photoId, new Date('2026-11-24T00:00:00Z'))).toBeNull()

      await repo.regroupLikes(group!.id, [tyrande, ash])
      expect((await repo.findLikeGroup(userId, photoId, new Date('2026-11-24T10:45:00Z')))?.actorIds).toEqual([
        tyrande,
        ash,
      ])
    })

    it('US-35.3 lists the latest first, counts the unread, marks one of its own and then all as read', async () => {
      const { repo, userId } = await make()
      await repo.create(like(userId, '2026-11-24T09:00:00Z', ['first']))
      await repo.create({
        userId,
        type: 'follow',
        payload: { actorId: 'second' },
        createdAt: new Date('2026-11-24T10:00:00Z'),
      })
      await repo.create(like(userId, '2026-11-24T11:00:00Z', ['third'], crypto.randomUUID()))
      const listed = await repo.list(userId, 2)
      expect(listed.map((n) => [n.type, n.readAt])).toEqual([
        ['like', null],
        ['follow', null],
      ])
      expect(listed[0]).toMatchObject({ payload: { actorIds: ['third'] }, createdAt: new Date('2026-11-24T11:00:00Z') })
      expect(await repo.countUnread(userId)).toBe(3)
      expect(await repo.list(crypto.randomUUID(), 10)).toEqual([])

      const at = new Date('2026-11-24T12:00:00Z')
      expect(await repo.markRead(crypto.randomUUID(), listed[0]!.id, at)).toBe(false) // another member's: untouched
      expect(await repo.markRead(userId, listed[0]!.id, at)).toBe(true)
      expect(await repo.markRead(userId, listed[0]!.id, new Date('2026-11-24T13:00:00Z'))).toBe(true) // kept date
      expect((await repo.list(userId, 1))[0]?.readAt).toEqual(at)
      expect(await repo.countUnread(userId)).toBe(2)
      await repo.markAllRead(userId, at)
      expect(await repo.countUnread(userId)).toBe(0)
    })

    it('US-35.5 deletes the notifications created before a date, and keeps the others', async () => {
      const { repo, userId } = await make()
      await repo.create(like(userId, '2026-05-23T23:59:59Z', ['old']))
      await repo.create(like(userId, '2026-05-24T00:00:00Z', ['kept']))
      await repo.purgeBefore(new Date('2026-05-24T00:00:00Z'))
      expect((await repo.findLikeGroup(userId, photoId, new Date('2026-01-01T00:00:00Z')))?.actorIds).toEqual(['kept'])
      await repo.purgeBefore(new Date('2026-05-24T00:00:01Z'))
      expect(await repo.findLikeGroup(userId, photoId, new Date('2026-01-01T00:00:00Z'))).toBeNull()
    })
  })
}
