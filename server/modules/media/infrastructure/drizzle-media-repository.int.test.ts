import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import { gameVersions, photos, users } from '../../../db/schema'
import { drizzleMediaRepository } from './drizzle-media-repository'

const HOUR = 3_600_000
const upload = (id: string, userId: string) => ({
  id,
  userId,
  mime: 'image/png' as const,
  bytes: 42,
  width: 1920,
  height: 1080,
})
const ids = ['0193a000-0000-7000-8000-000000000001', '0193a000-0000-7000-8000-000000000002']

async function member(tx: Parameters<Parameters<typeof withRollback>[0]>[0]) {
  const [row] = await tx
    .insert(users)
    .values({ username: `media_${crypto.randomUUID().slice(0, 8)}` })
    .returning()
  return row!.id
}

describe('drizzleMediaRepository', () => {
  it('US-10.1 creates an incomplete upload, then completes it once with the version of the slug', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      await repo.createUpload(upload(ids[0]!, userId))
      expect(await repo.findUpload(ids[0]!)).toEqual({
        id: ids[0],
        userId,
        mime: 'image/png',
        bytes: 42,
        uploadedAt: null,
      })
      const at = new Date()
      expect(await repo.complete(ids[0]!, { title: 'Dusk', gameVersion: 'wow-forever', at })).toBe(true)
      expect(await repo.complete(ids[0]!, { title: 'Again', gameVersion: 'wow-forever', at })).toBe(false)
      const [row] = await tx
        .select({ title: photos.title, status: photos.status, version: gameVersions.slug })
        .from(photos)
        .innerJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
        .where(eq(photos.id, ids[0]!))
      expect(row).toEqual({ title: 'Dusk', status: 'processing', version: 'wow-forever' })
      expect(await repo.findUpload(ids[1]!)).toBeNull()
    })
  })

  it('US-10.5 counts the incomplete uploads of the member since a date', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      const other = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      await repo.createUpload(upload('0193a000-0000-7000-8000-000000000003', other))
      await repo.complete(ids[1]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      expect(await repo.countIncomplete(userId, new Date(Date.now() - HOUR))).toBe(1)
      expect(await repo.countIncomplete(userId, new Date(Date.now() + HOUR))).toBe(0)
    })
  })

  it('US-10.7 lists and deletes the uploads never completed before a date, never a completed one', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleMediaRepository(tx)
      const userId = await member(tx)
      for (const id of ids) await repo.createUpload(upload(id, userId))
      await tx
        .update(photos)
        .set({ createdAt: new Date(Date.now() - 25 * HOUR) })
        .where(eq(photos.userId, userId))
      await repo.complete(ids[1]!, { title: 'Dusk', gameVersion: 'wow-forever', at: new Date() })
      const before = new Date(Date.now() - 24 * HOUR)
      // Other test files share the table: only this member's rows are checked
      const listed = await repo.incompleteBefore(before, 100)
      expect(listed).toContain(ids[0])
      expect(listed).not.toContain(ids[1])
      for (const id of ids) await repo.deleteIncomplete(id)
      const left = await tx.select({ id: photos.id }).from(photos).where(eq(photos.userId, userId))
      expect(left.map((r) => r.id)).toEqual([ids[1]])
    })
  })
})
