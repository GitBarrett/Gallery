import type { CatalogRepository, GameVersion } from '../../server/modules/catalog'

/** The versions seeded by migration 0009, in their order. */
export const LAUNCH_GAME_VERSIONS: GameVersion[] = [
  { slug: 'wow-forever', nameEn: 'WoW Forever', nameFr: 'WoW Forever' },
  { slug: 'retail', nameEn: 'Retail', nameFr: 'Retail' },
  { slug: 'classic-era', nameEn: 'Classic Era', nameFr: 'Classic Era' },
  { slug: 'classic-progression', nameEn: 'Classic progression', nameFr: 'Classic progression' },
  { slug: 'other', nameEn: 'Other', nameFr: 'Autre' },
]

/** In-memory CatalogRepository: the launch versions and `tags` (normalised), sorted by code point like the database. */
export function inMemoryCatalogRepository(seed: { tags?: string[] } = {}): CatalogRepository {
  return {
    async listGameVersions() {
      return LAUNCH_GAME_VERSIONS.map((v) => ({ ...v }))
    },
    async suggestTags(prefix, limit) {
      return (seed.tags ?? [])
        .filter((t) => t.startsWith(prefix))
        .sort()
        .slice(0, limit)
    },
  }
}
