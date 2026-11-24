import type { NotificationsResponse } from '../../../shared/contracts/notifications'
import { requireContext } from '../../platform/auth-context'

// The member's Quest log (US-35.3; 08-securite.md annexe B, row `/api/notifications*`): 401 without a session.
export default defineEventHandler(async (event): Promise<NotificationsResponse> => {
  const { container, actor } = await requireContext(event)
  return { notifications: await container.notifications.list({ userId: actor.id }) }
})
