import type { UnreadCountResponse } from '../../../shared/contracts/notifications'
import { requireContext } from '../../platform/auth-context'

// The bell's counter (US-35.1), read on load and every 60 s while the tab is visible.
export default defineEventHandler(async (event): Promise<UnreadCountResponse> => {
  const { container, actor } = await requireContext(event)
  return { unread: await container.notifications.unreadCount({ userId: actor.id }) }
})
