import { UploadUrlBody, type AvatarUploadUrlResponse } from '../../../shared/contracts/photos'
import { orThrow } from '../../modules/media'
import { requireContext } from '../../platform/auth-context'

// New avatar (US-07.6; annexe B): verified and active members, a square file of 2 MB at most, 10 a day.
export default defineEventHandler(async (event): Promise<AvatarUploadUrlResponse> => {
  const { container, actor } = await requireContext(event)
  const file = await readValidatedBody(event, UploadUrlBody.parse)
  const { version, url, expiresAt } = orThrow(await container.media.requestAvatarUpload({ actor, file }))
  return { version, url, expiresAt: expiresAt.toISOString() }
})
