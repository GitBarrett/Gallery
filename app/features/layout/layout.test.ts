import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import AppFooter from './AppFooter.vue'
import AppHeader from './AppHeader.vue'
import AppTabBar from './AppTabBar.vue'

const off = { leaderboard: false, contests: false, collections: false }
const on = { leaderboard: true, contests: true, collections: true }
const hrefs = (wrapper: { findAll: (s: string) => { attributes: (a: string) => string | undefined }[] }, s: string) =>
  wrapper.findAll(s).map((link) => link.attributes('href'))

describe('AppHeader', () => {
  it('shows only Explore at launch, every v1.x entry hidden by its flag', async () => {
    const wrapper = await mountSuspended(AppHeader, { props: { flags: off } })
    expect(hrefs(wrapper, '.nav a')).toEqual(['/explore'])
  })

  it('brings each entry back with its flag', async () => {
    const wrapper = await mountSuspended(AppHeader, { props: { flags: on } })
    expect(hrefs(wrapper, '.nav a')).toEqual(['/explore', '/leaderboard', '/contests', '/collections'])
  })

  it('offers Sign in to a visitor, notifications and profile to a member', async () => {
    const visitor = await mountSuspended(AppHeader, { props: { flags: off } })
    expect(hrefs(visitor, 'a')).toContain('/signin')
    const member = await mountSuspended(AppHeader, { props: { flags: off, username: 'jaina' } })
    expect(hrefs(member, 'a')).toEqual(expect.arrayContaining(['/notifications', '/u/jaina']))
    expect(hrefs(member, 'a')).not.toContain('/signin')
  })

  it('US-07.6 shows the avatar of the member in the profile link, the initial without one', async () => {
    const avatarUrl = '/avatar/0193a000-0000-7000-8000-0000000000a1/0193a000-0000-7000-8000-0000000000b2'
    const member = await mountSuspended(AppHeader, { props: { flags: off, username: 'jaina', avatarUrl } })
    expect(member.get('a[href="/u/jaina"] img').attributes('src')).toBe(`${avatarUrl}/64`)
    const initial = await mountSuspended(AppHeader, { props: { flags: off, username: 'jaina', avatarUrl: null } })
    expect(initial.get('a[href="/u/jaina"]').text()).toBe('J')
  })

  it('hides while scrolling down and comes back when scrolling up', async () => {
    const wrapper = await mountSuspended(AppHeader, { props: { flags: off } })
    const scrollTo = async (y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      await nextTick()
    }
    await scrollTo(300)
    expect(wrapper.get('header').classes()).toContain('hidden')
    await scrollTo(200)
    expect(wrapper.get('header').classes()).not.toContain('hidden')
    await scrollTo(0)
    wrapper.unmount()
  })
})

describe('AppTabBar', () => {
  it('US-67.1 lists Explore · Search · Upload · Notifications · Profile at launch, Upload in the centre', async () => {
    const wrapper = await mountSuspended(AppTabBar, { props: { flags: off } })
    expect(wrapper.findAll('.label').map((label) => label.text())).toEqual([
      'Explore',
      'Search',
      'Upload',
      'Notifications',
      'Profile',
    ])
    expect(wrapper.findAll('a')[2]!.classes()).toContain('upload')
    expect(hrefs(wrapper, 'a').at(-1)).toBe('/signin')
  })

  it('switches to the target tabs with the leaderboard and contests flags', async () => {
    const wrapper = await mountSuspended(AppTabBar, { props: { flags: on, username: 'jaina' } })
    expect(hrefs(wrapper, 'a')).toEqual(['/explore', '/leaderboard', '/upload', '/contests', '/u/jaina'])
  })
})

describe('layout parts', () => {
  it('have no serious accessibility violation', async () => {
    for (const wrapper of [
      await mountSuspended(AppHeader, { props: { flags: on, username: 'jaina' } }),
      await mountSuspended(AppHeader, { props: { flags: off } }),
      await mountSuspended(AppTabBar, { props: { flags: off } }),
      await mountSuspended(AppFooter),
    ])
      expect(await axeViolations(wrapper.element)).toEqual([])
  })
})

describe('AppFooter', () => {
  it('US-62.2 offers the other language, named in that language', async () => {
    const wrapper = await mountSuspended(AppFooter)
    const link = wrapper.get('a[hreflang="fr"]')
    expect(link.text()).toBe('Français')
    expect(link.attributes('href')).toBe('/fr')
    expect(link.attributes('lang')).toBe('fr')
  })
})
