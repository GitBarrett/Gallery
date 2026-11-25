import { PhotoParams, UpdatePhotoBody } from '../../../shared/contracts/photos'
import { orThrow } from '../../modules/media'
import { requireContext } from '../../platform/auth-context'

// Edit of a capture by its author (US-12.1, US-13.1; 08-securite.md annexe B): 403 for another member's published
// capture, 404 otherwise; 403 unverified or suspended; 400 for an insult or an unknown zone.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const body = await readValidatedBody(event, UpdatePhotoBody.parse)
  orThrow(await container.media.editCapture({ actor, photoId: id, ...body }))
  return sendNoContent(event)
})
