import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import type { Transaction } from '../../../db/client'
import { comments, gameVersions, photos, users } from '../../../db/schema'
import { drizzleCommentsRepository } from './drizzle-comments-repository'

async function world(tx: Transaction) {
  const run = crypto.randomUUID().slice(0, 8)
  const [author, fan, banned] = await tx
    .insert(users)
    .values([
      { username: `com_a_${run}` },
      { username: `com_f_${run}`, avatarKey: 'v1' },
      { username: `com_b_${run}`, status: 'banned' },
    ])
    .returning()
  const [version] = await tx.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const [photo] = await tx
    .insert(photos)
    .values({
      userId: author!.id,
      gameVersionId: version!.id,
      title: 'Comments',
      status: 'published',
      mime: 'image/png',
      bytes: 1,
      width: 1920,
      height: 1080,
      uploadedAt: new Date(),
      publishedAt: new Date(),
    })
    .returning()
  const count = async () =>
    (await tx.select({ n: photos.commentsCount }).from(photos).where(eq(photos.id, photo!.id)))[0]!.n
  return { author: author!.id, fan: fan!, banned: banned!.id, photoId: photo!.id, count }
}

describe('drizzleCommentsRepository', () => {
  it('US-31.1 US-31.3 US-31.4 adds, finds, edits and deletes a comment, the counter following', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleCommentsRepository(tx)
      const w = await world(tx)
      const { id, createdAt } = await repo.add({ photoId: w.photoId, userId: w.fan.id, body: '<b>Nice</b>' })
      expect(await w.count()).toBe(1)
      expect(await repo.find(id)).toEqual({
        id,
        photoId: w.photoId,
        userId: w.fan.id,
        photoAuthorId: w.author,
        createdAt,
      })
      const editedAt = new Date()
      await repo.edit(id, 'Nicer', editedAt)
      expect(await repo.list(w.photoId, undefined, 10)).toEqual([
        { id, body: 'Nicer', userId: w.fan.id, username: w.fan.username, avatarKey: 'v1', createdAt, editedAt },
      ])
      expect(await repo.remove(id)).toBe(true)
      expect(await repo.remove(id)).toBe(false)
      expect(await w.count()).toBe(0)
      expect(await repo.find(id)).toBeNull()
      expect(await repo.accountCreatedAt(w.fan.id)).toEqual(w.fan.createdAt)
    })
  })

  it('US-31.1 lists the visible comments newest first by pages, never those of a banned account nor hidden ones', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleCommentsRepository(tx)
      const w = await world(tx)
      const ids = []
      for (let n = 0; n < 3; n++) ids.push((await repo.add({ photoId: w.photoId, userId: w.fan.id, body: `${n}` })).id)
      // Same microsecond order as the inserts, whatever the clock: dates set apart
      for (const [n, id] of ids.entries())
        await tx
          .update(comments)
          .set({ createdAt: new Date(Date.UTC(2026, 10, 27, 10, n)) })
          .where(eq(comments.id, id))
      await repo.add({ photoId: w.photoId, userId: w.banned, body: 'banned' })
      const hidden = await repo.add({ photoId: w.photoId, userId: w.fan.id, body: 'hidden' })
      await tx.update(comments).set({ status: 'hidden' }).where(eq(comments.id, hidden.id))
      const first = await repo.list(w.photoId, undefined, 2)
      expect(first.map((c) => c.body)).toEqual(['2', '1'])
      const next = await repo.list(w.photoId, { createdAt: first[1]!.createdAt, id: first[1]!.id }, 2)
      expect(next.map((c) => c.body)).toEqual(['0'])
    })
  })
})
