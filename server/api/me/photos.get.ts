import { MyPhotosQuery, type MyPhotosResponse } from '../../../shared/contracts/photos'
import type { OwnCapture } from '../../modules/media'
import { requireContext } from '../../platform/auth-context'

// « My captures » (US-14.4; 08-securite.md annexe B, row "Compte"): the member's own captures, 401 without a session.
export default defineEventHandler(async (event): Promise<MyPhotosResponse> => {
  const { container, actor } = await requireContext(event)
  const { cursor } = await getValidatedQuery(event, MyPhotosQuery.parse)
  const page = await container.media.listMyCaptures({ userId: actor.id, cursor })
  return {
    items: page.items.map((c: OwnCapture) => ({
      ...c,
      status: c.status as MyPhotosResponse['items'][number]['status'],
      uploadedAt: c.uploadedAt.toISOString(),
    })),
    nextCursor: page.nextCursor,
  }
})
