import { CommentParams } from '../../../shared/contracts/comments'
import { orThrow } from '../../modules/social'
import { requireContext } from '../../platform/auth-context'

// Delete (US-31.4): the author of the comment or of its capture; 401 without a session, 403 for anyone else, 404 for
// a missing comment; 204.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, CommentParams.parse)
  orThrow(await container.social.deleteComment({ actor, commentId: id }))
  return sendNoContent(event)
})
