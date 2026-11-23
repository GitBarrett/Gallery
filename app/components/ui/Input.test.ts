import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { axeViolations } from '../../../tests/axe'
import Input from './Input.vue'

describe('UiInput', () => {
  it('ties its visible label to the field', async () => {
    const wrapper = await mountSuspended(Input, { props: { label: 'Email', type: 'email', autocomplete: 'email' } })
    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('email')
  })

  it('shows an action next to its label, outside the label', async () => {
    const wrapper = await mountSuspended(Input, {
      props: { label: 'Password' },
      slots: { action: () => h('a', { href: '/reset' }, 'Forgot password?') },
    })
    expect(wrapper.get('a').text()).toBe('Forgot password?')
    expect(wrapper.get('label').text()).toBe('Password')
  })

  it('updates its model as the user types', async () => {
    const wrapper = await mountSuspended(Input, { props: { label: 'Title', modelValue: '' } })
    await wrapper.get('input').setValue('Dawn on the Plains')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Dawn on the Plains']])
  })

  it('is a text area tied to its label when multiline', async () => {
    const wrapper = await mountSuspended(Input, { props: { label: 'Bio', multiline: true, modelValue: '' } })
    const area = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(area.attributes('id'))
    await area.setValue('Night elf hunter.')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Night elf hunter.']])
  })

  it('announces the hint and the error to assistive technologies', async () => {
    const wrapper = await mountSuspended(Input, {
      props: { label: 'Password', hint: '12 characters minimum', error: 'Too short', required: true },
    })
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('required')).toBeDefined()
    const described = input.attributes('aria-describedby')!.split(' ')
    expect(described.map((id) => wrapper.get(`#${id}`).text())).toEqual(['12 characters minimum', 'Too short'])
  })

  it('has no serious accessibility violation, with or without an error', async () => {
    for (const error of [undefined, 'Too short']) {
      const wrapper = await mountSuspended(Input, { props: { label: 'Username', error } })
      expect(await axeViolations(wrapper.element)).toEqual([])
    }
  })
})
