// gallery module (03-architecture.md § Modules): reading the captures — grids now, then the photo page, search, home
// and sitemap. Depends on catalog (and social later) through their index.ts only.
export { browseGrid, GRID_PAGE, type GalleryRepository, type GridCapture } from './application/grid'
export { drizzleGalleryRepository } from './infrastructure/drizzle-gallery-repository'
export { orThrow } from './interface/gallery-http'
