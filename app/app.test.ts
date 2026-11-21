import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from './app.vue'

// Smoke test of the `component` project: the Nuxt environment mounts the application and its home page.
describe('app', () => {
  it('renders the home page shell', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    expect(wrapper.find('main').exists()).toBe(true)
  })
})
