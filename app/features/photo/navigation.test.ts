import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { axeViolations } from '../../../tests/axe'
import { aCapture, aPhoto } from '../../../tests/builders/captures'
import PhotoNav from './PhotoNav.vue'
import QualityBadgeTip from './QualityBadgeTip.vue'
import RelatedBlock from './RelatedBlock.vue'
import { usePhotoNavigation } from './usePhotoNavigation'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)
registerEndpoint('/api/settings/public', () => ({
  qualityThresholds: { uncommon: 3, rare: 15, epic: 50, legendary: 150 },
  features: {
    contests: false,
    follows: false,
    collections: false,
    leaderboard: false,
    ads: false,
    donations: false,
    readonly: false,
    inviteOnly: true,
  },
}))
afterEach(() => {
  navigate.mockClear()
  vi.unstubAllGlobals()
})

const PREV = '0193a000-0000-7000-8000-0000000000a1'
const NEXT = '0193a000-0000-7000-8000-0000000000a2'

describe('PhotoNav', () => {
  it('US-67.2 links to the previous and next captures of the version, and leaves out a missing one', async () => {
    const nav = await mountSuspended(PhotoNav, { props: { prev: PREV, next: NEXT } })
    expect(nav.get('a[aria-label="Previous capture"]').attributes('href')).toBe(`/p/${PREV}`)
    expect(nav.get('a[aria-label="Next capture"]').attributes('href')).toBe(`/p/${NEXT}`)
    expect(await axeViolations(nav.element)).toEqual([])
    const last = await mountSuspended(PhotoNav, { props: { prev: PREV, next: null } })
    expect(last.findAll('a')).toHaveLength(1)
    const alone = await mountSuspended(PhotoNav, { props: { prev: null, next: null } })
    expect(alone.find('nav').exists()).toBe(false)
  })
})

describe('usePhotoNavigation', () => {
  const Harness = defineComponent({
    setup() {
      const target = ref<HTMLElement>()
      usePhotoNavigation(target, ref({ prev: PREV, next: NEXT }))
      return () => h('div', [h('figure', { ref: target }), h('input')])
    },
  })
  const pointer = (type: string, x: number, y = 0) =>
    new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', bubbles: true })

  it('US-67.2 a touch swipe to the left opens the next capture, to the right the previous one', async () => {
    const page = await mountSuspended(Harness)
    const figure = page.get('figure').element
    figure.dispatchEvent(pointer('pointerdown', 200))
    figure.dispatchEvent(pointer('pointerup', 100))
    expect(navigate).toHaveBeenLastCalledWith(`/p/${NEXT}`)
    figure.dispatchEvent(pointer('pointerdown', 100))
    figure.dispatchEvent(pointer('pointerup', 220, 20))
    expect(navigate).toHaveBeenLastCalledWith(`/p/${PREV}`)
    figure.dispatchEvent(pointer('pointerdown', 100))
    figure.dispatchEvent(pointer('pointerup', 110, 200)) // a vertical scroll
    expect(navigate).toHaveBeenCalledTimes(2)
    page.unmount() // its key listener on window would answer the next test too
  })

  it('US-67.2 the arrow keys open the previous and next captures, except while typing in a field', async () => {
    const page = await mountSuspended(Harness)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(navigate).toHaveBeenLastCalledWith(`/p/${NEXT}`)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(navigate).toHaveBeenLastCalledWith(`/p/${PREV}`)
    page.get('input').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(navigate).toHaveBeenCalledTimes(2)
    page.unmount()
  })
})

describe('RelatedBlock', () => {
  const photo = aPhoto({ zone: { slug: 'nagrand', nameEn: 'Nagrand', nameFr: 'Nagrand' } })
  const items = [aCapture({ id: PREV }), aCapture({ id: NEXT, quality: 'rare' })]

  it('US-70.1 names each section of the block: the author, then similar captures', async () => {
    const block = await mountSuspended(RelatedBlock, {
      props: {
        photo,
        sections: [
          { kind: 'author', items: [items[0]!] },
          { kind: 'similar', items: [items[1]!] },
        ],
      },
    })
    expect(block.findAll('h2').map((h2) => h2.text())).toEqual(['More from Kaelys', 'Similar captures'])
    expect(block.findAll('a').map((a) => a.attributes('href'))).toEqual([`/p/${PREV}`, `/p/${NEXT}`])
    expect(await axeViolations(block.element)).toEqual([])
  })

  it('US-70.2 without other capture of the author: More from the zone, or Latest in the version', async () => {
    const zone = await mountSuspended(RelatedBlock, { props: { photo, sections: [{ kind: 'zone', items }] } })
    expect(zone.get('h2').text()).toBe('More from Nagrand')
    const latest = await mountSuspended(RelatedBlock, { props: { photo, sections: [{ kind: 'latest', items }] } })
    expect(latest.get('h2').text()).toBe('Latest in WoW Forever')
  })
})

describe('QualityBadgeTip on a touch screen', () => {
  it('US-67.3 a touch on the badge opens a bottom sheet with its text', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    const tip = await mountSuspended(QualityBadgeTip, { props: { quality: 'rare', likes: 15 } })
    // the thresholds arrive with the public settings
    await vi.waitFor(() => expect(tip.get('[role="tooltip"]').text()).toContain('likes to Epic'))
    await tip.get('button.badge').trigger('click')
    await vi.waitFor(() => expect(tip.get('dialog').attributes('open')).toBeDefined())
    expect(tip.get('dialog').text()).toContain('Rare · 15+ likes · 35 likes to Epic')
    expect(tip.get('[role="tooltip"]').classes()).not.toContain('open') // no tooltip on top of it
  })
})
