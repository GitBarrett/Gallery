import type { MeResponse } from '../../shared/contracts/auth'
import { requireContext } from '../platform/auth-context'

// The signed-in member (08-securite.md annexe B, row "Compte"): 401 without a valid session.
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const { actor } = await requireContext(event)
  return { id: actor.id, username: actor.username, role: actor.role, emailVerified: actor.emailVerified }
})
