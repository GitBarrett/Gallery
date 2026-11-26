import { PhotoParams, type LikeResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/social'
import { requireContext } from '../../../platform/auth-context'

// Unlike (US-30.1): 401 without a session, 404 for a capture that is not public; idempotent.
export default defineEventHandler(async (event): Promise<LikeResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  return orThrow(await container.social.unlikePhoto({ actor, photoId: id }))
})
