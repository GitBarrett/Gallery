import type { CatalogRepository, GameVersion, Zone } from '../../server/modules/catalog'
import { normalizeTag } from '../../shared/domain/tags'

/** The versions seeded by migration 0009, in their order. */
export const LAUNCH_GAME_VERSIONS: GameVersion[] = [
  { slug: 'wow-forever', nameEn: 'WoW Forever', nameFr: 'WoW Forever' },
  { slug: 'retail', nameEn: 'Retail', nameFr: 'Retail' },
  { slug: 'classic-era', nameEn: 'Classic Era', nameFr: 'Classic Era' },
  { slug: 'classic-progression', nameEn: 'Classic progression', nameFr: 'Classic progression' },
  { slug: 'other', nameEn: 'Other', nameFr: 'Autre' },
]

// pg_trgm's similarity: trigrams of each word padded with two spaces before and one after, shared / all
const trigrams = (text: string) =>
  new Set(
    text
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .flatMap((word) => {
        const padded = `  ${word} `
        return Array.from({ length: padded.length - 2 }, (_, i) => padded.slice(i, i + 3))
      }),
  )
export function trigramSimilarity(a: string, b: string) {
  const [x, y] = [trigrams(a), trigrams(b)]
  const shared = [...x].filter((t) => y.has(t)).length
  return shared / (x.size + y.size - shared || 1)
}

/** A row of the zones table. */
export type SeedZone = Zone & { aliases: string[]; status: 'active' | 'pending' }

/**
 * In-memory CatalogRepository: the launch versions, `tags` (normalised) sorted by code point like the database, and
 * `zones` found by substring of their names and aliases (the database also tolerates typos, pg_trgm).
 */
export function inMemoryCatalogRepository(seed: { tags?: string[]; zones?: SeedZone[] } = {}): CatalogRepository {
  const tags = seed.tags ?? []
  return {
    async listGameVersions() {
      return LAUNCH_GAME_VERSIONS.map((v) => ({ ...v }))
    },
    async suggestTags(prefix, limit) {
      return tags
        .filter((t) => t.startsWith(prefix))
        .sort()
        .slice(0, limit)
    },
    async suggestZones(text, limit) {
      return (seed.zones ?? [])
        .filter((z) => z.status === 'active')
        .filter((z) => normalizeTag([z.nameEn, z.nameFr, ...z.aliases].join(' ')).includes(text))
        .map(({ slug, nameEn, nameFr }) => ({ slug, nameEn, nameFr }))
        .slice(0, limit)
    },
    async zoneId(slug) {
      const zone = (seed.zones ?? []).find((z) => z.slug === slug && z.status === 'active')
      return zone ? `zone-${zone.slug}` : null
    },
    async closestNames(text, limit) {
      const names = [
        ...(seed.zones ?? []).filter((z) => z.status === 'active').flatMap((z) => [z.nameEn, z.nameFr]),
        ...tags,
      ]
      return [
        ...new Set(
          names
            .map((label) => ({ label, score: trigramSimilarity(normalizeTag(label), text) }))
            .filter((n) => n.score >= 0.3)
            .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
            .map((n) => n.label),
        ),
      ].slice(0, limit)
    },
    async zoneIdByName(text) {
      const zone = (seed.zones ?? []).find(
        (z) => z.status === 'active' && [z.nameEn, z.nameFr, ...z.aliases].some((n) => normalizeTag(n) === text),
      )
      return zone ? `zone-${zone.slug}` : null
    },
    async ensureTags(slugs) {
      for (const slug of slugs) if (!tags.includes(slug)) tags.push(slug)
      return slugs.map((slug) => `tag-${slug}`)
    },
    async zoneById(id) {
      const zone = (seed.zones ?? []).find((z) => `zone-${z.slug}` === id)
      return zone ? { slug: zone.slug, nameEn: zone.nameEn, nameFr: zone.nameFr } : null
    },
    async tagSlugs(ids) {
      return ids.filter((id) => tags.includes(id.slice(4))).map((id) => id.slice(4))
    },
  }
}
