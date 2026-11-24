import { asc, eq, like, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, tags } from '../../../db/schema'
import type { CatalogRepository } from '../application/catalog'

/** game_versions and tags tables. The use case only passes prefixes of [a-z0-9 -]: no LIKE wildcard to escape. */
export const drizzleCatalogRepository = (db: Db | Transaction): CatalogRepository => ({
  async listGameVersions() {
    return db
      .select({ slug: gameVersions.slug, nameEn: gameVersions.nameEn, nameFr: gameVersions.nameFr })
      .from(gameVersions)
      .where(eq(gameVersions.archived, false))
      .orderBy(asc(gameVersions.position))
  },
  async suggestTags(prefix, limit) {
    const rows = await db
      .select({ slug: tags.slug })
      .from(tags)
      .where(like(tags.slug, `${prefix}%`))
      .orderBy(sql`${tags.slug} collate "C"`) // code point order, as the prefix index
      .limit(limit)
    return rows.map((r) => r.slug)
  },
})
