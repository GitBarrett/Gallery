import type { SessionsResponse } from '../../../shared/contracts/auth'
import type { DeviceSession } from '../../modules/identity'
import { requireContext, sessionIdOf } from '../../platform/auth-context'

// The member's devices (US-03.7, 08-securite.md annexe B row "Compte"): 401 without a valid session.
export default defineEventHandler(async (event): Promise<SessionsResponse> => {
  const { container, actor } = await requireContext(event)
  const sessions = await container.identity.listSessions({ userId: actor.id, sessionId: (await sessionIdOf(event))! })
  return {
    sessions: sessions.map((s: DeviceSession) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    })),
  }
})
