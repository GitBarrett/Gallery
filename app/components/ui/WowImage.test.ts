import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import WowImage from './WowImage.vue'

const props = { src: '/capture.webp', alt: 'Suramar canals at dusk', width: 1600, height: 900 }

describe('UiWowImage', () => {
  it('sets its alternative text and its size, so the layout does not shift', async () => {
    const wrapper = await mountSuspended(WowImage, { props })
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: '/capture.webp',
      alt: 'Suramar canals at dusk',
      width: '1600',
      height: '900',
    })
  })

  it('loads lazily, except the main image of the page', async () => {
    const lazy = await mountSuspended(WowImage, { props })
    expect(lazy.get('img').attributes()).toMatchObject({ loading: 'lazy', decoding: 'async' })
    expect(lazy.get('img').attributes('fetchpriority')).toBeUndefined()
    const lcp = await mountSuspended(WowImage, { props: { ...props, priority: true } })
    expect(lcp.get('img').attributes()).toMatchObject({ loading: 'eager', fetchpriority: 'high' })
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(WowImage, { props })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
