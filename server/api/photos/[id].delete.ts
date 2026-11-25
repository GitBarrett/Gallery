import { PhotoParams } from '../../../shared/contracts/photos'
import { orThrow } from '../../modules/media'
import { requireContext } from '../../platform/auth-context'

// Deletion of a capture by its author (US-12.2; 08-securite.md annexe B), a suspended one included: 403 for another
// member's published capture, 404 otherwise or when already deleted; 409 while it is processing.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  orThrow(await container.media.deleteCapture({ actor, photoId: id }))
  return sendNoContent(event)
})
