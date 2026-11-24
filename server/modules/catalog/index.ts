// catalog module (03-architecture.md § Modules): game versions and tags; zones join with T-20b.
export { listGameVersions, suggestTags, type CatalogRepository, type GameVersion } from './application/catalog'
export { drizzleCatalogRepository } from './infrastructure/drizzle-catalog-repository'
