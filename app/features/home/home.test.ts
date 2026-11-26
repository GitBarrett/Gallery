import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aCapture } from '../../../tests/builders/captures'
import CaptureOfTheWeek from './CaptureOfTheWeek.vue'
import HomeHero from './HomeHero.vue'
import QuestBanner from './QuestBanner.vue'
import { useHome } from './useHome'

const HERO = '0193a000-0000-7000-8000-0000000000e1'
const hero = {
  id: HERO,
  title: 'Moonlit Path',
  width: 1920,
  height: 1080,
  focalX: 0.25,
  focalY: null,
  author: { username: 'Lunelame' },
}
registerEndpoint('/api/home', () => ({ hero, week: null, latest: [aCapture()] }))

describe('HomeHero', () => {
  it('US-24.1 shows the hero on its focal point, the title, two calls to action and the credit linked to its page', async () => {
    const section = await mountSuspended(HomeHero, { props: { hero } })
    const img = section.get('img')
    expect(img.attributes()).toMatchObject({ loading: 'eager', fetchpriority: 'high', width: '1920', height: '1080' })
    expect(img.attributes('style')).toContain('--focal: 25% 50%')
    expect(section.get('h1').text()).toBe('Azeroth, seen by its players.')
    expect(section.findAll('.actions a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Upload a capture', '/upload'],
      ['Explore the gallery', '/explore'],
    ])
    expect(section.get('.credit').text()).toBe('Background: “Moonlit Path” by Lunelame')
    expect(section.get('.credit a').attributes('href')).toBe(`/p/${HERO}`)
    expect(await axeViolations(section.element)).toEqual([])
  })

  it('US-24.1 without a capture dark enough, the same text on the page gradient, no credit', async () => {
    const section = await mountSuspended(HomeHero, { props: { hero: null } })
    expect(section.find('img').exists()).toBe(false)
    expect(section.get('h1').text()).toBe('Azeroth, seen by its players.')
    expect(section.find('.credit').exists()).toBe(false)
  })
})

describe('CaptureOfTheWeek', () => {
  it('US-70.4 shows the capture chosen and the step that chose it, linked to its page', async () => {
    const capture = aCapture({ likes: 42, quality: 'rare' })
    const week = await mountSuspended(CaptureOfTheWeek, { props: { week: { reason: 'month', capture } } })
    expect(week.get('h2').text()).toBe('Capture of the week')
    expect(week.get('.reason').text()).toBe('Most liked this month')
    expect(week.get('a').attributes('href')).toBe(`/p/${capture.id}`)
    const pick = await mountSuspended(CaptureOfTheWeek, { props: { week: { reason: 'pick', capture } } })
    expect(pick.get('.reason').text()).toBe("Editor's pick")
  })
})

describe('QuestBanner', () => {
  const contest = { title: 'Night Capitals', text: 'One city after dark.', slug: 'night-capitals' }

  it('US-24.3 announces an open contest, only with the contests enabled', async () => {
    const shown = await mountSuspended(QuestBanner, { props: { enabled: true, contest } })
    expect(shown.text()).toContain('New contest: Night Capitals.')
    expect(shown.get('a').attributes('href')).toBe('/contests/night-capitals')
    for (const props of [
      { enabled: false, contest },
      { enabled: true, contest: null },
    ]) {
      const hidden = await mountSuspended(QuestBanner, { props })
      expect(hidden.find('aside').exists(), JSON.stringify(props)).toBe(false)
    }
  })
})

describe('useHome', () => {
  it('US-24.2 reads the home of the server', async () => {
    const home = await useHome()
    expect(home.value).toMatchObject({ hero: { id: HERO }, week: null, latest: [{ id: aCapture().id }] })
  })
})
