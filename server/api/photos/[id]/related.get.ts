import { PhotoParams, type RelatedResponse } from '../../../../shared/contracts/photos'
import { orThrow, type RelatedSection } from '../../../modules/gallery'

// Navigation of a photo page (US-67.2, US-70.1, US-70.2), for every visitor (annexe B, "Lectures publiques"): the
// previous and next captures of its version and the « More from » block. Cached at the edge (03 § API).
export default defineEventHandler(async (event): Promise<RelatedResponse> => {
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const { prev, next, sections } = orThrow(await event.context.container.gallery.relatedPhotos({ id }))
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    prev,
    next,
    sections: sections.map((s: RelatedSection) => ({
      kind: s.kind,
      items: s.items.map((item) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
    })),
  }
})
