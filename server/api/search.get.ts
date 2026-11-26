import { SearchQuery, type SearchResponse } from '../../shared/contracts/photos'
import { orThrow, type GridCapture } from '../modules/gallery'

const serialised = (item: GridCapture) => ({ ...item, publishedAt: item.publishedAt.toISOString() })

// A search (US-21), for every visitor (annexe B, "Lectures publiques"); cached at the edge like the grids (03 § API).
export default defineEventHandler(async (event): Promise<SearchResponse> => {
  const query = await getValidatedQuery(event, SearchQuery.parse)
  const page = orThrow(await event.context.container.gallery.searchPhotos(query))
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    ...page,
    items: page.items.map(serialised),
    empty: page.empty && { ...page.empty, latest: page.empty.latest.map(serialised) },
  }
})
