import { PhotoParams, type PhotoResponse } from '../../../shared/contracts/photos'
import { orThrow, type PhotoRow } from '../../modules/gallery'

// The photo page of a published capture (US-25.1), for every visitor (annexe B, "Lectures publiques"); any other
// capture is not found. Cached at the edge (03 § API).
export default defineEventHandler(async (event): Promise<PhotoResponse> => {
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const photo: PhotoRow & { quality: PhotoResponse['quality'] } = orThrow(
    await event.context.container.gallery.viewPhoto({ id }),
  )
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return { ...photo, publishedAt: photo.publishedAt.toISOString() }
})
