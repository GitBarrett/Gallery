import { CompleteUploadBody, PhotoParams, type CompleteUploadResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/media'
import { requireContext } from '../../../platform/auth-context'

// End of an upload (US-10.1, US-10.6): 404 for another member's capture, 422 when the object is missing or differs
// from what was declared. Idempotent, so the `Idempotency-Key` header needs nothing more.
export default defineEventHandler(async (event): Promise<CompleteUploadResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const body = await readValidatedBody(event, CompleteUploadBody.parse)
  return orThrow(await container.media.completeUpload({ actor, photoId: id, ...body }))
})
