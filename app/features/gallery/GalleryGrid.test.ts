import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aCapture } from '../../../tests/builders/captures'
import GalleryGrid from './GalleryGrid.vue'
import GalleryTile from './GalleryTile.vue'

const zone = { slug: 'nagrand', nameEn: 'Nagrand', nameFr: 'Nagrand' }

describe('GalleryTile', () => {
  it('US-20.1 shows the image at its ratio, the quality, the title, the zone and the author', async () => {
    const tile = await mountSuspended(GalleryTile, {
      props: { capture: aCapture({ quality: 'rare', likes: 42, zone }) },
    })
    const img = tile.get('img')
    expect(img.attributes()).toMatchObject({
      width: '1920',
      height: '1080',
      alt: 'Dawn on the Plains, captured by Kaelys',
    })
    expect(tile.get('.badge').text()).toBe('Rare')
    expect(tile.get('.title').classes()).toContain('rare')
    expect(tile.get('.meta').text()).toBe('Nagrand · Kaelys')
    expect(tile.get('.likes').text()).toBe('42 likes')
    expect(tile.get('a').attributes('href')).toBe('/p/0193a000-0000-7000-8000-0000000000c1') // US-25.1: the PDP
  })

  it('US-70.6 shows « New » instead of a counter under 10 likes for 7 days, then nothing', async () => {
    const recent = new Date(Date.now() - 86_400_000).toISOString() // relative: the test never ages
    const tile = await mountSuspended(GalleryTile, { props: { capture: aCapture({ likes: 9, publishedAt: recent }) } })
    expect(tile.find('.likes').exists()).toBe(false)
    expect(tile.get('.new').text()).toBe('New')
    expect(tile.get('.meta').text()).toBe('Kaelys')
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString()
    const older = await mountSuspended(GalleryTile, { props: { capture: aCapture({ likes: 4, publishedAt: old }) } })
    expect(older.find('.new').exists()).toBe(false)
    expect(older.find('.likes').exists()).toBe(false)
  })
})

describe('GalleryGrid', () => {
  const captures = [aCapture(), aCapture({ id: '0193a000-0000-7000-8000-0000000000c2', title: 'Arcane Dusk' })]

  it('US-20.2 asks for the next page from the « Load more » button, then says the end', async () => {
    const grid = await mountSuspended(GalleryGrid, {
      props: { captures, label: 'WoW Forever captures', done: false, loading: false },
    })
    expect(grid.findAll('li')).toHaveLength(2)
    await grid.get('button').trigger('click')
    expect(grid.emitted('more')).toHaveLength(1)
    await grid.setProps({ done: true })
    expect(grid.find('button').exists()).toBe(false)
    expect(grid.text()).toContain("You've seen everything")
  })

  it('says why a page could not be loaded', async () => {
    const grid = await mountSuspended(GalleryGrid, {
      props: { captures, label: 'x', done: false, loading: false, error: 'Something went wrong.' },
    })
    expect(grid.get('[role="alert"]').text()).toBe('Something went wrong.')
  })

  it('has no serious accessibility violation', async () => {
    const grid = await mountSuspended(GalleryGrid, {
      props: { captures, label: 'WoW Forever captures', done: true, loading: false },
    })
    expect(await axeViolations(grid.element)).toEqual([])
  })
})
