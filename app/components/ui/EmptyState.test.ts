import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import EmptyState from './EmptyState.vue'

describe('UiEmptyState', () => {
  it('shows a title, a description and an action, never an empty block (07-design.md § États vides)', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: { title: 'Be the first to capture WoW Forever', description: 'No capture yet for this version.' },
      slots: { action: () => 'Upload a capture' },
    })
    expect(wrapper.get('h2').text()).toBe('Be the first to capture WoW Forever')
    expect(wrapper.text()).toContain('No capture yet for this version.')
    expect(wrapper.text()).toContain('Upload a capture')
  })

  it('fits the heading level of the page around it', async () => {
    const wrapper = await mountSuspended(EmptyState, { props: { title: 'No captures yet', headingLevel: 3 } })
    expect(wrapper.find('h3').exists()).toBe(true)
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(EmptyState, { props: { title: 'Be the first to comment' } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
