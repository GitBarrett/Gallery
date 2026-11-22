import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineBanner from '../layout/OfflineBanner.vue'
import CachedPages from './CachedPages.vue'

afterEach(() => vi.unstubAllGlobals())

describe('OfflineBanner', () => {
  it('US-64.3 appears with the offline event and goes away online', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const wrapper = await mountSuspended(OfflineBanner)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    onLine.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe("You're offline")
    onLine.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
    onLine.mockRestore()
  })
})

describe('CachedPages', () => {
  it('US-64.2 lists the pages saved by the service worker, once each', async () => {
    const keys = ['/', '/explore', '/'].map((path) => new Request(`http://localhost${path}`))
    vi.stubGlobal('caches', { open: async () => ({ keys: async () => keys }) })
    const wrapper = await mountSuspended(CachedPages)
    await vi.waitFor(() => expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual(['/', '/explore']))
  })

  it('says so when nothing is saved', async () => {
    vi.stubGlobal('caches', { open: async () => ({ keys: async () => [] }) })
    const wrapper = await mountSuspended(CachedPages)
    expect(wrapper.text()).toBe('No page saved yet.')
  })
})
