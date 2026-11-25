import { PhotoParams, type MyPhotoResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/media'
import { requireContext } from '../../../platform/auth-context'

// One of the member's captures with its details, for its edit form (US-12.1; annexe B, row "Compte"): 404 for
// another member's capture or an unknown one.
export default defineEventHandler(async (event): Promise<MyPhotoResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const capture = orThrow(await container.media.getMyCapture({ userId: actor.id, photoId: id }))
  return { ...capture, status: capture.status as MyPhotoResponse['status'] }
})
