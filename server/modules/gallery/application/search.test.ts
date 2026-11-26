import { describe, expect, it, vi } from 'vitest'
import { decodeOffset, encodeOffset } from '../domain/cursor'
import type { GalleryRepository, GridFilter, GridRow } from './grid'
import { searchPhotos } from './search'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const row = (n: number): GridRow => ({
  id: `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
  title: `Capture ${n}`,
  width: 1920,
  height: 1080,
  username: 'Ash',
  zone: null,
  likes: n,
  downloads: 0,
  publishedAt: new Date(Date.UTC(2026, 10, 25, 10, n)),
})

function setup(rows: GridRow[] = []) {
  const grid = vi.fn<GalleryRepository['grid']>(async (f: GridFilter) => rows.slice(0, f.limit))
  const zoneByName = vi.fn(async (text: string) => (text === 'hurlevent' ? 'zone-stormwind' : null))
  const search = searchPhotos({
    repo: { grid },
    gameVersions: async () => [{ slug: 'wow-forever' }],
    zoneByName,
    thresholds: async () => thresholds,
  })
  return { grid, zoneByName, search }
}

describe('searchPhotos', () => {
  it('US-21.4 searches the zone the query names, its words and the tags it names', async () => {
    const { grid, search } = setup([row(1)])
    const result = await search({ q: '  Hurlevent ', sort: 'relevance' })
    expect(result).toMatchObject({ ok: true, value: { query: 'hurlevent', items: [{ id: row(1).id }] } })
    expect(grid).toHaveBeenCalledWith(
      expect.objectContaining({
        match: { text: 'hurlevent', zoneId: 'zone-stormwind', tags: ['hurlevent'] },
        relevance: { offset: 0 },
      }),
    )
  })

  it('US-21.7 cleans and cuts a long query with control characters, and gives nothing for a too short one', async () => {
    const { grid, search } = setup([row(1)])
    const long = await search({ q: `night\u0000 ${'x'.repeat(200)}`, sort: 'recent' })
    expect(long.ok && long.value.query.length).toBe(100)
    expect(long.ok && long.value.query.startsWith('night ')).toBe(true)
    grid.mockClear()
    expect(await search({ q: ' a ', sort: 'relevance' })).toEqual({
      ok: true,
      value: { query: 'a', items: [], nextCursor: null },
    })
    expect(grid).not.toHaveBeenCalled()
  })

  it('US-21.1 sorts by relevance, recency or popularity, each with the cursor of its pages', async () => {
    const rows = [row(3), row(2), row(1)]
    const { grid, search } = setup(rows)
    const relevant = await search({ q: 'nagrand', sort: 'relevance', limit: 2 })
    if (!relevant.ok) throw new Error('refused')
    expect(decodeOffset(relevant.value.nextCursor!)).toBe(2)
    await search({ q: 'nagrand', sort: 'relevance', cursor: relevant.value.nextCursor!, limit: 2 })
    expect(grid.mock.lastCall?.[0].relevance).toEqual({ offset: 2 })
    const popular = await search({
      q: 'nagrand',
      sort: 'popular',
      minQuality: 'rare',
      version: 'wow-forever',
      limit: 2,
    })
    expect(grid.mock.lastCall?.[0]).toMatchObject({ sort: 'popular', minLikes: 15, gameVersion: 'wow-forever' })
    expect(grid.mock.lastCall?.[0].relevance).toBeUndefined()
    expect(popular.ok && popular.value.nextCursor).toEqual(expect.any(String))
  })

  it('does not find an unknown version and refuses a cursor of another sort', async () => {
    const { search } = setup([row(1)])
    expect(await search({ q: 'nagrand', version: 'cataclysm', sort: 'relevance' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
    expect(await search({ q: 'nagrand', sort: 'recent', cursor: encodeOffset(30) })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'cursor', reason: 'unknown' },
    })
  })
})
