// catalog module (03-architecture.md § Modules): game versions, zones dictionary and tags.
export {
  ensureTags,
  findZone,
  listGameVersions,
  suggestTags,
  suggestZones,
  type CatalogRepository,
  type GameVersion,
  type Zone,
} from './application/catalog'
export { drizzleCatalogRepository } from './infrastructure/drizzle-catalog-repository'
