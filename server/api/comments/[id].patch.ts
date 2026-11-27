import { CommentBody, CommentParams, type CommentEdited } from '../../../shared/contracts/comments'
import { orThrow } from '../../modules/social'
import { requireContext } from '../../platform/auth-context'

// Edit (US-31.3): 401 without a session, 403 for another member's comment or after 15 minutes, 404 for a missing
// one, 400 for a text out of the rules.
export default defineEventHandler(async (event): Promise<CommentEdited> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, CommentParams.parse)
  const { body } = await readValidatedBody(event, CommentBody.parse)
  const edited = orThrow(await container.social.editComment({ actor, commentId: id, body }))
  return { ...edited, editedAt: edited.editedAt.toISOString() }
})
