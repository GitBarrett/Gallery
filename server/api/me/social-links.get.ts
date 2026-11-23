import type { SocialLinksBody } from '../../../shared/contracts/auth'
import { requireContext } from '../../platform/auth-context'

// Identifiers of the signed-in member as stored, for the settings (US-82.5: kept even when the profile hides them).
export default defineEventHandler(async (event): Promise<SocialLinksBody> => {
  const { container, actor } = await requireContext(event)
  return { links: await container.identity.getSocialLinks({ actor }) }
})
