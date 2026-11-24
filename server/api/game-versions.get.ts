import type { GameVersionsResponse } from '../../shared/contracts/catalog'

// Game versions of the catalogue, for every visitor (annexe B, "Lectures publiques"); cached at the edge (03 § API).
export default defineEventHandler(async (event): Promise<GameVersionsResponse> => {
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return { versions: await event.context.container.catalog.listGameVersions() }
})
