import { UploadUrlBody, type UploadUrlResponse } from '../../../shared/contracts/photos'
import { orThrow } from '../../modules/media'
import { requireContext } from '../../platform/auth-context'

// Upload request (US-10.1): 401 without a session, 403 unverified or sanctioned, 400 or 413 for a file out of the
// rules (US-10.2), 429 past 20 uploads in 24 h or 3 at once (US-10.5).
export default defineEventHandler(async (event): Promise<UploadUrlResponse> => {
  const { container, actor } = await requireContext(event)
  const file = await readValidatedBody(event, UploadUrlBody.parse)
  const { photoId, url, expiresAt } = orThrow(await container.media.requestUploadUrl({ actor, file }))
  return { photoId, url, expiresAt: expiresAt.toISOString() }
})
