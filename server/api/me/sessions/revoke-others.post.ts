import { requireContext, sessionIdOf } from '../../../platform/auth-context'

// Revokes every session of the member but this one (US-03.9).
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  await container.identity.revokeOtherSessions({ userId: actor.id, sessionId: (await sessionIdOf(event))! })
  return sendNoContent(event)
})
