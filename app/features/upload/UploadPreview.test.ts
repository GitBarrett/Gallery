import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import UploadPreview from './UploadPreview.vue'

describe('UploadPreview', () => {
  it('US-11.4 shows the details typed in the item tooltip: version, zone, in-game time, size, caption', async () => {
    const wrapper = await mountSuspended(UploadPreview, {
      props: {
        title: 'Dawn on the Plains',
        version: 'WoW Forever',
        zone: 'Nagrand',
        time: '06:12',
        width: 3840,
        height: 2160,
        caption: 'First light on the floating isles.',
      },
    })
    const tooltip = wrapper.get('.item-tooltip').text()
    for (const text of ['Dawn on the Plains', 'Poor capture · WoW Forever', 'Nagrand', '06:12 in-game', '3840 × 2160'])
      expect(tooltip).toContain(text)
    expect(tooltip).toContain('First light on the floating isles.')
    expect(wrapper.text()).toContain('Every capture starts as Poor')
    expect(await axeViolations(wrapper.element)).toEqual([])
  })

  it('names an untitled capture and leaves out what is not typed yet', async () => {
    const wrapper = await mountSuspended(UploadPreview, { props: { title: '  ' } })
    expect(wrapper.get('.item-tooltip').text()).toContain('Untitled capture')
    expect(wrapper.text()).not.toContain('in-game')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
