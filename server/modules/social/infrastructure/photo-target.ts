import { eq } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, photos, users } from '../../../db/schema'
import type { LikeTarget } from '../application/ports'

/** A capture liked or commented: its author, and whether it is public (the rule of the grids, gallery visible()). */
export async function photoTarget(db: Db | Transaction, photoId: string): Promise<LikeTarget | null> {
  const [row] = await db
    .select({
      authorId: photos.userId,
      status: photos.status,
      archived: gameVersions.archived,
      authorStatus: users.status,
    })
    .from(photos)
    .innerJoin(users, eq(users.id, photos.userId))
    .leftJoin(gameVersions, eq(gameVersions.id, photos.gameVersionId))
    .where(eq(photos.id, photoId))
  if (!row) return null
  // Published, version not archived, author neither banned nor leaving
  const shown =
    row.status === 'published' && row.archived === false && !['banned', 'pending_deletion'].includes(row.authorStatus)
  return { authorId: row.authorId, public: shown }
}
