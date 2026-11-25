import type { MeResponse } from '../../shared/contracts/auth'
import { avatarPath } from '../../shared/domain/avatar-file'
import { requireContext } from '../platform/auth-context'

// The signed-in member (08-securite.md annexe B, row "Compte"): 401 without a valid session.
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const { actor } = await requireContext(event)
  const { id, username, role, emailVerified } = actor
  return { id, username, role, emailVerified, avatarUrl: avatarPath(id, actor.avatar) }
})
