import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import FocalPicker from './FocalPicker.vue'

describe('FocalPicker', () => {
  it('US-13.1 records the point touched on the image, from the left and the top', async () => {
    const wrapper = await mountSuspended(FocalPicker, {
      props: {
        src: 'blob:dusk',
        modelValue: null,
        'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as null }),
      },
    })
    const frame = wrapper.get('.frame')
    frame.element.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 200 }) as DOMRect
    await frame.trigger('click', { clientX: 200, clientY: 200 })
    expect(wrapper.props('modelValue')).toEqual({ x: 0.25, y: 0.75 })
    expect(wrapper.get('.marker').attributes('style')).toContain('left: 25%')
    expect(wrapper.findAll<HTMLInputElement>('input[type="range"]').map((r) => r.element.value)).toEqual(['25', '75'])
  })

  it('US-13.1 sets the same point with the sliders (keyboard); US-13.2 back to the centre', async () => {
    const wrapper = await mountSuspended(FocalPicker, {
      props: {
        src: 'blob:dusk',
        modelValue: null,
        'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as null }),
      },
    })
    expect(wrapper.find('.marker').exists()).toBe(false) // none: the centre
    const [horizontal] = wrapper.findAll('input[type="range"]')
    expect(horizontal!.attributes('aria-valuetext')).toBe('50 %')
    await horizontal!.setValue('10')
    expect(wrapper.props('modelValue')).toEqual({ x: 0.1, y: 0.5 })
    await wrapper.get('button').trigger('click')
    expect(wrapper.props('modelValue')).toBeNull()
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
