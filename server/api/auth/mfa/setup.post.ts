import { orThrow } from '../../../modules/identity'
import { requireContext } from '../../../platform/auth-context'

// First step of the staff TOTP (US-55.2): 401 without a session, 403 for a member or once the TOTP is enabled.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  return orThrow(await container.identity.startMfaSetup({ actor }))
})
