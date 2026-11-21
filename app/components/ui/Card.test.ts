import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Card from './Card.vue'

describe('UiCard', () => {
  it('wraps its content in a neutral block by default', async () => {
    const wrapper = await mountSuspended(Card, { slots: { default: () => 'Content' } })
    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.text()).toBe('Content')
  })

  it('uses the semantic tag the context needs', async () => {
    const wrapper = await mountSuspended(Card, { props: { as: 'article' }, slots: { default: () => 'Capture' } })
    expect(wrapper.element.tagName).toBe('ARTICLE')
  })
})
