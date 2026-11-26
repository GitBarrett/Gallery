import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm'
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
  async closestNames(text, limit) {
    // `%`: similarity ≥ pg_trgm.similarity_threshold (0.3 by default, ADR-007), served by the trigram indexes
    const en = sql`public.f_unaccent(lower(${zones.nameEn}))`
    const fr = sql`public.f_unaccent(lower(${zones.nameFr}))`
    const rows = await db.execute<{ label: string; score: number }>(sql`
      select label, score from (
        select ${zones.nameEn} as label, similarity(${en}, ${text}) as score from ${zones}
          where ${zones.status} = 'active' and ${en} % ${text}
        union all
        select ${zones.nameFr}, similarity(${fr}, ${text}) from ${zones}
          where ${zones.status} = 'active' and ${fr} % ${text}
        union all
        select ${tags.slug}, similarity(${tags.slug}, ${text}) from ${tags} where ${tags.slug} % ${text}
      ) as close order by score desc, label limit ${limit * 2}`)
    return [...new Set(Array.from(rows, (r) => r.label))].slice(0, limit)
  },
  async zoneIdByName(text) {
    // The names as normalizeTag gives the query: lower case, no accents (unaccent also turns œ into oe)
    const same = (column: SQL) => sql`unaccent(lower(${column})) = ${text}`
    const [row] = await db
      .select({ id: zones.id })
      .from(zones)
      .where(
        and(
          eq(zones.status, 'active'),
          or(
            same(sql`${zones.nameEn}`),
            same(sql`${zones.nameFr}`),
            sql`exists (select 1 from unnest(${zones.aliases}) as alias where unaccent(lower(alias)) = ${text})`,
          ),
        ),
      )
      .orderBy(asc(zones.slug))
      .limit(1)
    return row?.id ?? null
  },
  async zoneId(slug) {
    const [row] = await db
      .select({ id: zones.id })
      .from(zones)
      .where(and(eq(zones.slug, slug), eq(zones.status, 'active')))
    return row?.id ?? null
  },
  async ensureTags(slugs) {
    if (!slugs.length) return []
    // Concurrent uploads may create the same tag: the unique slug keeps one, then both read it
    await db
      .insert(tags)
      .values(slugs.map((slug) => ({ slug, label: slug })))
      .onConflictDoNothing()
    const rows = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs))
    const ids = new Map(rows.map((r) => [r.slug, r.id]))
    return slugs.map((slug) => ids.get(slug)!)
  },
  async zoneById(id) {
    const [row] = await db
      .select({ slug: zones.slug, nameEn: zones.nameEn, nameFr: zones.nameFr })
      .from(zones)
      .where(eq(zones.id, id))
    return row ?? null
  },
  async tagSlugs(ids) {
    if (!ids.length) return []
    const rows = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.id, ids))
    const slugs = new Map(rows.map((r) => [r.id, r.slug]))
    return ids.flatMap((id) => slugs.get(id) ?? [])
  },
})
