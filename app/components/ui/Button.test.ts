import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import Button from './Button.vue'

describe('UiButton', () => {
  it('renders a native button of type button by default, with its label', async () => {
    const wrapper = await mountSuspended(Button, { slots: { default: () => 'Upload a capture' } })
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toBe('Upload a capture')
    expect(button.classes()).toEqual(expect.arrayContaining(['primary', 'md']))
  })

  it('becomes a link when it leads to a page', async () => {
    const wrapper = await mountSuspended(Button, {
      props: { to: '/upload', variant: 'secondary' },
      slots: { default: () => 'Upload' },
    })
    expect(wrapper.get('a').attributes('href')).toBe('/upload')
  })

  it('stays a disabled button, never a link, when disabled', async () => {
    const wrapper = await mountSuspended(Button, {
      props: { to: '/upload', disabled: true },
      slots: { default: () => 'Upload' },
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('submits a form when asked', async () => {
    const wrapper = await mountSuspended(Button, { props: { type: 'submit' }, slots: { default: () => 'Sign in' } })
    expect(wrapper.get('button').attributes('type')).toBe('submit')
  })

  it('has no serious accessibility violation in any variant', async () => {
    for (const variant of ['primary', 'secondary', 'ghost'] as const) {
      const wrapper = await mountSuspended(Button, { props: { variant }, slots: { default: () => 'Explore' } })
      expect(await axeViolations(wrapper.element)).toEqual([])
    }
  })

  it('is flagged by the accessibility check when it has no label', async () => {
    const wrapper = await mountSuspended(Button)
    expect(await axeViolations(wrapper.element)).toEqual([expect.stringMatching(/^button-name/)])
  })
})
