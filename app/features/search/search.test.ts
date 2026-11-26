import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { getQuery, setResponseStatus } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aCapture } from '../../../tests/builders/captures'
import { readSearch, writeSearch, type Search } from './query'
import SearchBox from './SearchBox.vue'
import SearchEmpty from './SearchEmpty.vue'
import SearchFilterFields from './SearchFilterFields.vue'
import { useSearch } from './useSearch'

const asked: Record<string, unknown>[] = []
registerEndpoint('/api/search', (event) => {
  const query = getQuery(event)
  asked.push(query)
  if (query.version === 'cataclysm') {
    setResponseStatus(event, 404)
    return { error: { code: 'NOT_FOUND', message: 'Not found', correlationId: 'c' } }
  }
  const page = (id: string, nextCursor: string | null) => ({
    query: String(query.q).toLowerCase(),
    corrected: null,
    items: [aCapture({ id })],
    nextCursor,
    empty: null,
  })
  return query.cursor
    ? page('0193a000-0000-7000-8000-0000000000c3', null)
    : page('0193a000-0000-7000-8000-0000000000c1', 'next-page')
})
registerEndpoint('/api/zones/suggest', () => ({
  zones: [{ slug: 'stormwind', nameEn: 'Stormwind City', nameFr: 'Hurlevent' }],
}))
registerEndpoint('/api/tags/suggest', () => ({ tags: ['hurricane'] }))
afterEach(() => vi.useRealTimers())

describe('search query', () => {
  it('US-21.1 reads and writes the search of the URL, defaults and unknown values left out', () => {
    expect(readSearch({ q: 'nagrand', version: 'retail', quality: 'rare', sort: 'popular' })).toEqual({
      q: 'nagrand',
      version: 'retail',
      minQuality: 'rare',
      sort: 'popular',
    })
    expect(readSearch({ q: ['a', 'b'], version: 'Bad slug!', quality: 'poor', sort: 'relevance' })).toEqual({
      q: 'a',
      version: undefined,
      minQuality: undefined,
      sort: undefined,
    })
    expect(readSearch({})).toEqual({ q: '', version: undefined, minQuality: undefined, sort: undefined })
    expect(writeSearch({ q: '  nagrand ', minQuality: 'epic', sort: 'recent' })).toEqual({
      q: 'nagrand',
      quality: 'epic',
      sort: 'recent',
    })
    expect(writeSearch({ q: ' ', minQuality: 'poor', sort: 'relevance' })).toEqual({})
  })
})

describe('useSearch', () => {
  it('US-21.1 asks the first page of a search with its filters, then the next one by its cursor', async () => {
    const results = await useSearch(ref<Search>({ q: ' Nagrand ', minQuality: 'rare', sort: 'recent' }))
    expect(asked.at(-1)).toEqual({ q: 'Nagrand', minQuality: 'rare', sort: 'recent' })
    expect(results.page.value?.query).toBe('nagrand')
    await results.loadMore()
    expect(asked.at(-1)).toEqual({ q: 'Nagrand', minQuality: 'rare', sort: 'recent', cursor: 'next-page' })
    expect(results.captures.value).toHaveLength(2)
    expect(results.done.value).toBe(true)
  })

  it('asks nothing without a text, and does not find an unknown version', async () => {
    const count = asked.length
    const blank = await useSearch(ref<Search>({ q: '  ' }))
    expect(asked).toHaveLength(count)
    expect(blank.page.value).toBeUndefined()
    expect(blank.found.value).toBe(true)
    const unknown = await useSearch(ref<Search>({ q: 'nagrand', version: 'cataclysm' }))
    expect(unknown.found.value).toBe(false)
  })
})

describe('SearchBox', () => {
  async function typed(text: string) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const box = await mountSuspended(SearchBox, { props: { query: '' } })
    const input = box.get('input')
    await input.setValue(text)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    return { box, input }
  }

  it('US-21.3 suggests the zones in the language of the visitor and the tags matching what is typed', async () => {
    const { box, input } = await typed('Hur')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(box.findAll('[role="option"]').map((o) => o.text())).toEqual(['Stormwind CityZone', '#hurricaneTag'])
    vi.useRealTimers() // axe waits on real timers
    expect(await axeViolations(box.element)).toEqual([])
  })

  it('US-21.3 chooses a suggestion with the arrows and Enter, or closes the list with Escape', async () => {
    const { box, input } = await typed('Hur')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    const second = box.findAll('[role="option"]')[1]!
    expect(input.attributes('aria-activedescendant')).toBe(second.attributes('id'))
    expect(second.attributes('aria-selected')).toBe('true')
    await box.get('form').trigger('submit')
    expect(box.emitted('search')).toEqual([['hurricane']])
    expect(input.attributes('aria-expanded')).toBe('false')
    await input.setValue('Hurl')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    await box.get('form').trigger('submit') // Enter without a suggestion chosen: the text typed
    expect(box.emitted('search')!.at(-1)).toEqual(['Hurl'])
  })

  it('US-21.3 runs the search of a suggestion clicked, and suggests nothing under 2 characters', async () => {
    const { box } = await typed('Hur')
    await box.findAll('[role="option"]')[0]!.trigger('mousedown')
    expect(box.emitted('search')).toEqual([['Stormwind City']])
    const short = await typed('H')
    expect(short.input.attributes('aria-expanded')).toBe('false')
  })
})

describe('SearchFilterFields', () => {
  it('US-21.1 emits each change of version, minimum quality and sort, keeping the text', async () => {
    const versions = [{ slug: 'retail', nameEn: 'Retail', nameFr: 'Retail' }]
    const fields = await mountSuspended(SearchFilterFields, {
      props: { search: { q: 'nagrand' }, versions, thresholds: null },
    })
    const [version, sort] = fields.findAll('select')
    await version!.setValue('retail')
    await sort!.setValue('popular')
    await fields
      .findAll('button[aria-pressed]')
      .find((b) => b.text() === 'Epic')!
      .trigger('click')
    expect(fields.emitted('change')).toEqual([
      [{ q: 'nagrand', version: 'retail' }],
      [{ q: 'nagrand', sort: 'popular' }],
      [{ q: 'nagrand', minQuality: 'epic' }],
    ])
  })
})

describe('SearchEmpty', () => {
  it('US-21.6 offers the close names, the popular tags and the latest captures, as links', async () => {
    const empty = await mountSuspended(SearchEmpty, {
      props: {
        query: 'qqq',
        empty: { suggestions: ['Suramar'], popularTags: ['night'], latest: [aCapture()] },
      },
    })
    expect(empty.text()).toContain('No capture found for “qqq”')
    expect(empty.get('a[href="/search?q=Suramar"]').text()).toBe('Suramar')
    expect(empty.get('a[href="/search?q=night"]').text()).toBe('#night')
    expect(empty.findAll('article')).toHaveLength(1)
    const bare = await mountSuspended(SearchEmpty, {
      props: { query: 'qqq', empty: { suggestions: [], popularTags: [], latest: [] } },
    })
    expect(bare.findAll('h2')).toHaveLength(1) // only the message: never an empty block
    expect(await axeViolations(empty.element)).toEqual([])
  })
})
