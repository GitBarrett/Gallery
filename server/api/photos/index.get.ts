import { PhotosQuery, type PhotosResponse } from '../../../shared/contracts/photos'
import { orThrow, type GridCapture } from '../../modules/gallery'

// A page of a grid (US-20.1, US-20.3), for every visitor (annexe B, "Lectures publiques"); cached at the edge (03 § API).
export default defineEventHandler(async (event): Promise<PhotosResponse> => {
  const query = await getValidatedQuery(event, PhotosQuery.parse)
  const { items, nextCursor } = orThrow(await event.context.container.gallery.browseGrid(query))
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    items: items.map((item: GridCapture) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
    nextCursor,
  }
})
