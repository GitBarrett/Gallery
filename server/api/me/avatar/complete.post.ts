import { AvatarCompleteBody } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/media'
import { requireContext } from '../../../platform/auth-context'

// End of an avatar upload (US-07.6): 404 for a version that is not the pending one, 422 when the object differs.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { version } = await readValidatedBody(event, AvatarCompleteBody.parse)
  orThrow(await container.media.completeAvatarUpload({ actor, version }))
  return sendNoContent(event)
})
