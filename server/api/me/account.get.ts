import type { AccountResponse } from '../../../shared/contracts/auth'
import { requireContext } from '../../platform/auth-context'

// Email of the signed-in member, for the settings (US-07.2); MeResponse, read on every page, stays without it.
export default defineEventHandler(async (event): Promise<AccountResponse> => {
  const { container, actor } = await requireContext(event)
  return container.identity.getAccount({ userId: actor.id })
})
