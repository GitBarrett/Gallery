import { SocialLinksBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { requireContext } from '../../platform/auth-context'

// Replaces the social networks of the signed-in member (US-82.1–3): 401 without a session, 400 naming the network
// whose identifier is refused, 429 after 20 saves in an hour.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { links } = await readValidatedBody(event, SocialLinksBody.parse)
  orThrow(await container.identity.setSocialLinks({ actor, links }))
  return sendNoContent(event)
})
