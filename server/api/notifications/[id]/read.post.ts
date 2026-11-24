import { NotificationParams } from '../../../../shared/contracts/notifications'
import { requireContext } from '../../../platform/auth-context'
import { AppError } from '../../../platform/http-errors'

// Marks one of the member's notifications read (US-35.3); another member's or an unknown one: 404.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, NotificationParams.parse)
  const result = await container.notifications.markRead({ userId: actor.id, id })
  if (!result.ok) throw new AppError('NOT_FOUND', 'Not found')
  return sendNoContent(event)
})
