import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import AppTabBar from '../layout/AppTabBar.vue'
import UpdateToast from './UpdateToast.vue'

const pwa = reactive({ needRefresh: true, updateServiceWorker: vi.fn() })
mockNuxtImport('useNuxtApp', (original) => () => Object.assign(original(), { $pwa: pwa }))

const off = { leaderboard: false, contests: false, collections: false }

describe('UpdateToast', () => {
  it('US-65.1 shows "A new version is available · Reload", which activates the new version', async () => {
    const wrapper = await mountSuspended(UpdateToast)
    expect(wrapper.text()).toContain('A new version is available')
    await wrapper.get('button').trigger('click')
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('US-65.2 waits for the end of an upload', async () => {
    const uploading = useUploadInProgress()
    uploading.value = true
    const wrapper = await mountSuspended(UpdateToast)
    expect(wrapper.text()).not.toContain('A new version is available')
    uploading.value = false
    await nextTick()
    expect(wrapper.text()).toContain('A new version is available')
  })
})

describe('Upload offline', () => {
  it('US-64.3 the Upload button and tab are disabled offline, with the reason', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const header = await mountSuspended(AppHeader, { props: { flags: off } })
    const button = header.findAll('button').find((b) => b.text().includes('Upload'))!
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe("You're offline")
    const tabBar = await mountSuspended(AppTabBar, { props: { flags: off } })
    const tab = tabBar.get('[aria-disabled="true"]')
    expect(tab.text()).toContain('Upload')
    expect(tab.attributes('href')).toBeUndefined()
    onLine.mockRestore()
  })
})
