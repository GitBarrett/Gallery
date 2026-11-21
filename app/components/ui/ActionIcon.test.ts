import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import ActionIcon from './ActionIcon.vue'

const icon = () => '♥'

describe('UiActionIcon', () => {
  it('is a button named by its label, the icon hidden from assistive technologies', async () => {
    const wrapper = await mountSuspended(ActionIcon, { props: { label: 'Full screen' }, slots: { default: icon } })
    const button = wrapper.get('button')
    expect(button.attributes()).toMatchObject({ type: 'button', 'aria-label': 'Full screen', title: 'Full screen' })
    expect(wrapper.get('[aria-hidden="true"]').text()).toBe('♥')
  })

  it('is a toggle only when pressed is given', async () => {
    const plain = await mountSuspended(ActionIcon, { props: { label: 'Share' }, slots: { default: icon } })
    expect(plain.get('button').attributes('aria-pressed')).toBeUndefined()
    const off = await mountSuspended(ActionIcon, { props: { label: 'Like', pressed: false }, slots: { default: icon } })
    expect(off.get('button').attributes('aria-pressed')).toBe('false')
    const on = await mountSuspended(ActionIcon, { props: { label: 'Like', pressed: true }, slots: { default: icon } })
    expect(on.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('acts on click, except when disabled', async () => {
    const onClick = vi.fn()
    const wrapper = await mountSuspended(ActionIcon, { props: { label: 'Like', onClick }, slots: { default: icon } })
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
    await wrapper.setProps({ disabled: true })
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(ActionIcon, {
      props: { label: 'Like', pressed: true },
      slots: { default: icon },
    })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
