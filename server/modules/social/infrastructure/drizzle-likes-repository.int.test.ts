import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import { createDb, type Db, type Transaction } from '../../../db/client'
import { gameVersions, likes, photos, users } from '../../../db/schema'
import { drizzleLikesRepository } from './drizzle-likes-repository'

async function world(db: Db | Transaction) {
  const run = crypto.randomUUID().slice(0, 8)
  const [author, fan] = await db
    .insert(users)
    .values([{ username: `like_a_${run}` }, { username: `like_f_${run}` }])
    .returning()
  const [version] = await db.select().from(gameVersions).where(eq(gameVersions.slug, 'wow-forever'))
  const capture = (status = 'published') =>
    db
      .insert(photos)
      .values({
        userId: author!.id,
        gameVersionId: version!.id,
        title: 'Like',
        status,
        mime: 'image/png',
        bytes: 1,
        width: 1920,
        height: 1080,
        uploadedAt: new Date(),
        publishedAt: new Date(),
      })
      .returning()
      .then(([row]) => row!.id)
  return { author: author!.id, fan: fan!.id, capture }
}

describe('drizzleLikesRepository', () => {
  it('US-30.1 adds a like once and removes it, the counter following', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleLikesRepository(tx)
      const w = await world(tx)
      const id = await w.capture()
      expect(await repo.target(id)).toEqual({ authorId: w.author, public: true })
      expect(await repo.state(w.fan, id)).toEqual({ liked: false, likes: 0 })
      expect(await repo.add(w.fan, id)).toEqual({ changed: true, likes: 1 })
      expect(await repo.add(w.fan, id)).toEqual({ changed: false, likes: 1 })
      expect(await repo.state(w.fan, id)).toEqual({ liked: true, likes: 1 })
      expect(await repo.state(w.author, id)).toEqual({ liked: false, likes: 1 })
      expect(await repo.remove(w.fan, id)).toEqual({ changed: true, likes: 0 })
      expect(await repo.remove(w.fan, id)).toEqual({ changed: false, likes: 0 })
    })
  })

  it('finds a capture that is not public as such, and none for an unknown id', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleLikesRepository(tx)
      const w = await world(tx)
      expect(await repo.target(await w.capture('hidden'))).toEqual({ authorId: w.author, public: false })
      expect(await repo.target(crypto.randomUUID())).toBeNull()
    })
  })

  it('US-71.4 records the tier told to the author, never lowered', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleLikesRepository(tx)
      const id = await (await world(tx)).capture()
      expect(await repo.raiseNotifiedTier(id, 1)).toBe(true)
      expect(await repo.raiseNotifiedTier(id, 1)).toBe(false)
      expect(await repo.raiseNotifiedTier(id, 3)).toBe(true)
      expect(await repo.raiseNotifiedTier(id, 2)).toBe(false)
    })
  })

  // Committed rows and two connections: a transaction would serialise the calls
  it('US-30.3 counts one like of two simultaneous ones from the same account', async () => {
    const db = createDb(process.env.DATABASE_URL!)
    const other = createDb(process.env.DATABASE_URL!)
    const w = await world(db)
    try {
      const id = await w.capture()
      const [one, two] = [drizzleLikesRepository(db), drizzleLikesRepository(other)]
      const results = await Promise.all([one.add(w.fan, id), two.add(w.fan, id)])
      expect(results.filter((r) => r.changed)).toHaveLength(1)
      expect((await db.select().from(likes).where(eq(likes.photoId, id))).length).toBe(1)
      expect((await db.select({ n: photos.likesCount }).from(photos).where(eq(photos.id, id)))[0]!.n).toBe(1)
    } finally {
      await db.delete(users).where(eq(users.id, w.author)) // captures and likes cascade
      await db.delete(users).where(eq(users.id, w.fan))
      await Promise.all([db.$client.end(), other.$client.end()])
    }
  })
})
