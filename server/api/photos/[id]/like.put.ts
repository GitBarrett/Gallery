import { PhotoParams, type LikeResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/social'
import { requireContext } from '../../../platform/auth-context'

// Like (US-30): 401 without a session, 403 for their own capture or a sanctioned member, 404 for a capture that is
// not public, 429 past 120 likes in an hour; idempotent.
export default defineEventHandler(async (event): Promise<LikeResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  return orThrow(await container.social.likePhoto({ actor, photoId: id }))
})
