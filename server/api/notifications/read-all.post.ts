import { requireContext } from '../../platform/auth-context'

// « Mark all as read » of the Quest log (US-35.3).
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  await container.notifications.markAllRead({ userId: actor.id })
  return sendNoContent(event)
})
