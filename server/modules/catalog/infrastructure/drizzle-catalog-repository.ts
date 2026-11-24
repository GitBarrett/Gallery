import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { gameVersions, tags, zones } from '../../../db/schema'
import type { CatalogRepository } from '../application/catalog'

/**
 * game_versions, zones and tags tables. The use case only passes tag prefixes of [a-z0-9 -]: no LIKE wildcard to escape.
 */
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
  async suggestZones(text, limit) {
    // Both names and the aliases, lower case without accents, as normalizeTag gives the text
    const names = sql`unaccent(lower(${zones.nameEn} || ' ' || ${zones.nameFr} || ' ' || array_to_string(${zones.aliases}, ' ')))`
    // A typo: 0.5 lets "hurlvent" find Hurlevent (0.58), below the 0.6 of the `<%` operator (Q66)
    // shortcut: no trigram index, a scan of the zones; fine for a few thousand rows, add a GIN index when it shows
    return db
      .select({ slug: zones.slug, nameEn: zones.nameEn, nameFr: zones.nameFr })
      .from(zones)
      .where(
        and(
          eq(zones.status, 'active'),
          sql`(strpos(${names}, ${text}) > 0 or word_similarity(${text}, ${names}) >= 0.5)`,
        ),
      )
      .orderBy(desc(sql`word_similarity(${text}, ${names})`), asc(zones.nameEn))
      .limit(limit)
  },
})
