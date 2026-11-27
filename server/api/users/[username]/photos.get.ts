import { ProfileParams } from '../../../../shared/contracts/auth'
import { UserPhotosQuery, type PhotosResponse } from '../../../../shared/contracts/photos'
import { orThrow, type GridCapture } from '../../../modules/gallery'

// The captures of a profile (US-05.3), for every visitor (annexe B, "Lectures publiques"); cached at the edge like
// the grids (03 § API).
export default defineEventHandler(async (event): Promise<PhotosResponse> => {
  const { username } = await getValidatedRouterParams(event, ProfileParams.parse)
  const query = await getValidatedQuery(event, UserPhotosQuery.parse)
  const { items, nextCursor } = orThrow(await event.context.container.gallery.authorCaptures({ username, ...query }))
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    items: items.map((item: GridCapture) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
    nextCursor,
  }
})
