import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery, setResponseStatus } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import { aCapture } from '../../../tests/builders/captures'
import { useGalleryFeed } from './useGalleryFeed'

const asked: Record<string, unknown>[] = []
registerEndpoint('/api/photos', (event) => {
  const query = getQuery(event)
  asked.push(query)
  if (query.version === 'cataclysm') {
    setResponseStatus(event, 404)
    return { error: { code: 'NOT_FOUND', message: 'Not found', correlationId: 'c' } }
  }
  if (query.zone === 'gone') {
    setResponseStatus(event, 400)
    const details = { field: 'zone', reason: 'unknown' }
    return { error: { code: 'VALIDATION_FAILED', message: 'Invalid zone', details, correlationId: 'c' } }
  }
  return query.cursor
    ? { items: [aCapture({ id: '0193a000-0000-7000-8000-0000000000c3' })], nextCursor: null }
    : {
        items: [aCapture({ id: '0193a000-0000-7000-8000-0000000000c1' })],
        nextCursor: 'next-page',
      }
})

describe('useGalleryFeed', () => {
  it('US-20.1 loads the first page of the published captures of a version', async () => {
    const feed = await useGalleryFeed('wow-forever')
    expect(feed.found.value).toBe(true)
    expect(feed.captures.value.map((c) => c.id)).toEqual(['0193a000-0000-7000-8000-0000000000c1'])
    expect(asked.at(-1)).toEqual({ version: 'wow-forever' })
    expect(feed.done.value).toBe(false)
  })

  it('US-20.2 appends the next page by its cursor, then ends', async () => {
    const feed = await useGalleryFeed('retail')
    await feed.loadMore()
    expect(asked.at(-1)).toEqual({ version: 'retail', cursor: 'next-page' })
    expect(feed.captures.value).toHaveLength(2)
    expect(feed.done.value).toBe(true)
    await feed.loadMore() // nothing more to ask
    expect(asked.at(-1)).toEqual({ version: 'retail', cursor: 'next-page' })
  })

  it('US-20.4 does not find an unknown or archived version', async () => {
    const feed = await useGalleryFeed('cataclysm')
    expect(feed.found.value).toBe(false)
    expect(feed.failed.value).toBe(false)
  })

  it('US-20.3 asks the page of the filters, again when they change, and the next page with the same filters', async () => {
    const filters = ref<{ timeOfDay?: 'dusk' | 'night'; sort?: 'popular' }>({ timeOfDay: 'dusk' })
    const feed = await useGalleryFeed('classic-era', filters)
    expect(asked.at(-1)).toEqual({ version: 'classic-era', timeOfDay: 'dusk' })
    filters.value = { timeOfDay: 'night', sort: 'popular' }
    await vi.waitFor(() =>
      expect(asked.at(-1)).toEqual({ version: 'classic-era', timeOfDay: 'night', sort: 'popular' }),
    )
    await feed.loadMore()
    expect(asked.at(-1)).toEqual({ version: 'classic-era', timeOfDay: 'night', sort: 'popular', cursor: 'next-page' })
  })

  it('US-20.3 a zone no more in the dictionary matches nothing, without an error page', async () => {
    const feed = await useGalleryFeed('classic-era', ref({ zone: 'gone' }))
    expect(feed.found.value).toBe(true)
    expect(feed.failed.value).toBe(false)
    expect(feed.captures.value).toEqual([])
  })
})
