// catalog module (03-architecture.md § Modules): game versions, zones dictionary and tags.
export {
  closestNames,
  ensureTags,
  findZone,
  listGameVersions,
  tagSlugs,
  zoneById,
  zoneByName,
  suggestTags,
  suggestZones,
  type CatalogRepository,
  type GameVersion,
  type Zone,
} from './application/catalog'
export { drizzleCatalogRepository } from './infrastructure/drizzle-catalog-repository'
