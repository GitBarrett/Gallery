import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import WowImage from './WowImage.vue'

const id = '0193a000-0000-7000-8000-0000000000aa'
const props = { photoId: id, alt: 'Suramar canals at dusk, captured by Lunelame', width: 1600, height: 900 }

describe('UiWowImage', () => {
  it('US-68.3 offers the stored WebP widths of /img, with its size reserved and its alternative text', async () => {
    const wrapper = await mountSuspended(WowImage, { props })
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: `/img/${id}/1200`,
      srcset: `/img/${id}/400 400w, /img/${id}/800 800w, /img/${id}/1200 1200w, /img/${id}/2400 2400w`,
      sizes: '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
      alt: 'Suramar canals at dusk, captured by Lunelame',
      width: '1600',
      height: '900',
    })
  })

  it('US-14.4 asks every width of the private preview, and takes the sizes of its grid', async () => {
    const wrapper = await mountSuspended(WowImage, { props: { ...props, preview: true, sizes: '100vw' } })
    expect(wrapper.get('img').attributes('src')).toBe(`/img/${id}/1200?preview=1`)
    expect(wrapper.get('img').attributes('srcset')).toContain(`/img/${id}/2400?preview=1 2400w`)
    expect(wrapper.get('img').attributes('sizes')).toBe('100vw')
  })

  it('US-68.1 loads lazily, except the main image of the page', async () => {
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
