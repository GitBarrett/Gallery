import { api } from '~/services/api'

export const POLL_MS = 60_000

/** Unread notifications of the bell, shared by the header, the tab bar and the Quest log (US-35.1). */
export const useUnread = () => useState('notifications-unread', () => 0)

/**
 * Keeps the bell's counter fresh (US-35.1): on load, every 60 s while the tab is visible, and when it shows again.
 * Called once, by the layout. A failed read (offline) keeps the last value.
 */
export function useUnreadPolling(signedIn: Ref<boolean>) {
  const unread = useUnread()
  async function refresh() {
    if (!signedIn.value) return (unread.value = 0)
    if (document.visibilityState !== 'visible') return
    try {
      unread.value = (await api.unreadCount()).unread
    } catch {
      // offline or signed out meanwhile: the next tick tries again
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    void refresh()
    timer = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
  })
  watch(signedIn, refresh)
}
