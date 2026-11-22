import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TurnstileCheck from './TurnstileCheck.vue'

const turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
let available = true
vi.mock('./turnstile', () => ({
  loadTurnstile: () => (available ? Promise.resolve(turnstile) : Promise.reject(new Error('offline'))),
}))

describe('TurnstileCheck', () => {
  it('renders the check for its action and gives the token, reset after use', async () => {
    turnstile.render.mockImplementation((_element, options) => {
      options.callback('solved')
      return 'widget-1'
    })
    const wrapper = await mountSuspended(TurnstileCheck, { props: { action: 'signup' } })
    await flushPromises()
    expect(turnstile.render.mock.calls[0]![1]).toMatchObject({ action: 'signup', sitekey: '1x00000000000000000000AA' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['solved']])
    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
    wrapper.unmount()
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1')
  })

  it('says so when the check cannot load', async () => {
    available = false
    const wrapper = await mountSuspended(TurnstileCheck, { props: { action: 'signup' } })
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('could not load')
    available = true
  })
})
