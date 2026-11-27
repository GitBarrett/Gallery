import { PhotoParams, type LikeResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/social'
import { requireContext } from '../../../platform/auth-context'

// The member's like of a capture and its counter (US-30.1), for the Like button: the photo page is cached for
// everyone, this answer is the member's own (never cached). 401 without a session, 404 for a capture not public.
export default defineEventHandler(async (event): Promise<LikeResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return orThrow(await container.social.viewLike({ actor, photoId: id }))
})
