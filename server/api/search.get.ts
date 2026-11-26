import { SearchQuery, type SearchResponse } from '../../shared/contracts/photos'
import { orThrow, type GridCapture } from '../modules/gallery'

// A search (US-21), for every visitor (annexe B, "Lectures publiques"); cached at the edge like the grids (03 § API).
export default defineEventHandler(async (event): Promise<SearchResponse> => {
  const query = await getValidatedQuery(event, SearchQuery.parse)
  const { query: text, items, nextCursor } = orThrow(await event.context.container.gallery.searchPhotos(query))
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    query: text,
    items: items.map((item: GridCapture) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
    nextCursor,
  }
})
