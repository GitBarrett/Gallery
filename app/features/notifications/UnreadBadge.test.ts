import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import UnreadBadge from './UnreadBadge.vue'
import { POLL_MS, useUnread, useUnreadPolling } from './useUnread'

let unread = 3
registerEndpoint('/api/notifications/unread-count', () => ({ unread }))

const Bell = defineComponent({
  setup: () => {
    useUnreadPolling(ref(true))
    return () => h(UnreadBadge)
  },
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('UnreadBadge', () => {
  it('US-35.1 shows the unread count on load, then every 60 s while the tab is visible', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const wrapper = await mountSuspended(Bell)
    await vi.waitFor(() => expect(wrapper.text()).toBe('33 unread'))

    unread = 120
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(useUnread().value).toBe(3) // hidden tab: no request

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await vi.advanceTimersByTimeAsync(POLL_MS)
    await vi.waitFor(() => expect(wrapper.get('[aria-hidden="true"]').text()).toBe('99+'))
    expect(wrapper.text()).toContain('120 unread')
  })

  it('is hidden at 0', async () => {
    useUnread().value = 0
    unread = 0
    const wrapper = await mountSuspended(UnreadBadge)
    expect(wrapper.find('.badge').exists()).toBe(false)
  })
})
