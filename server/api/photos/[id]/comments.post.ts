import { CommentBody, type CommentItem } from '../../../../shared/contracts/comments'
import { PhotoParams } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/social'
import { requireContext } from '../../../platform/auth-context'

// Comment (US-31): 401 without a session, 403 unverified or sanctioned, 404 for a capture not public, 400 for a text
// out of the rules or a missing Turnstile token (accounts of less than 24 h), 429 past 10 in 10 minutes.
export default defineEventHandler(async (event): Promise<CommentItem> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const body = await readValidatedBody(event, CommentBody.parse)
  const ip = getHeader(event, 'cf-connecting-ip')
  const comment = orThrow(await container.social.postComment({ actor, photoId: id, ...body, ip }))
  setResponseStatus(event, 201)
  return { ...comment, createdAt: comment.createdAt.toISOString(), editedAt: null }
})
