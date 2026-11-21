import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import Toast from './Toast.vue'

const props = { message: 'A new version is available', actionLabel: 'Reload', dismissLabel: 'Dismiss' }

describe('UiToast', () => {
  it('keeps its live region in the page while closed, so the message is announced when it appears', async () => {
    const wrapper = await mountSuspended(Toast, { props: { ...props, open: false } })
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await wrapper.setProps({ open: true })
    expect(wrapper.get('[role="status"]').text()).toContain('A new version is available')
  })

  it('US-65.1 offers its action and can be dismissed', async () => {
    const wrapper = await mountSuspended(Toast, { props: { ...props, open: true } })
    await wrapper.get('button:not([aria-label])').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
    await wrapper.get('button[aria-label="Dismiss"]').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('shows no action button without an action label', async () => {
    const wrapper = await mountSuspended(Toast, {
      props: { message: 'Link copied', dismissLabel: 'Dismiss', open: true },
    })
    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(Toast, { props: { ...props, open: true } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
