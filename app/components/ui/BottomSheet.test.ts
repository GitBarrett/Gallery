import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BottomSheet from './BottomSheet.vue'
import Modal from './Modal.vue'

describe('UiBottomSheet', () => {
  it('US-67.3 is the modal anchored at the bottom, with its content', async () => {
    const wrapper = await mountSuspended(BottomSheet, {
      props: { title: 'Epic', closeLabel: 'Close' },
      slots: { default: () => '500+ likes' },
    })
    expect(wrapper.getComponent(Modal).props()).toMatchObject({
      title: 'Epic',
      closeLabel: 'Close',
      placement: 'bottom',
    })
    expect(wrapper.get('dialog').text()).toContain('500+ likes')
  })

  it('US-67.4 opens full screen for the filters, and passes the model through', async () => {
    const wrapper = await mountSuspended(BottomSheet, { props: { title: 'Filters', closeLabel: 'Close', full: true } })
    const modal = wrapper.getComponent(Modal)
    expect(modal.props('placement')).toBe('full')
    modal.vm.$emit('update:open', true)
    expect(wrapper.emitted('update:open')).toEqual([[true]])
  })
})
