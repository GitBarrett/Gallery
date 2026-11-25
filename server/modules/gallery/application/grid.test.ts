import { describe, expect, it, vi } from 'vitest'
import { decodeCursor } from '../domain/cursor'
import { browseGrid, type GalleryRepository, type GridFilter, type GridRow } from './grid'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const row = (n: number, more: Partial<GridRow> = {}): GridRow => ({
  id: `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
  title: `Capture ${n}`,
  width: 1920,
  height: 1080,
  username: 'Ash',
  zone: null,
  likes: n,
  downloads: 100 - n,
  publishedAt: new Date(Date.UTC(2026, 10, 25, 10, n)),
  ...more,
})

function setup(rows: GridRow[] = []) {
  const grid = vi.fn<GalleryRepository['grid']>(async (filter: GridFilter) => rows.slice(0, filter.limit))
  const browse = browseGrid({
    repo: { grid },
    gameVersions: async () => [{ slug: 'wow-forever' }, { slug: 'retail' }],
    zoneOf: async (slug) => (slug === 'stormwind' ? '0193a000-0000-7000-8000-00000000z001' : null),
    thresholds: async () => thresholds,
  })
  return { grid, browse }
}

describe('browseGrid', () => {
  it('US-20.1 gives a page of 30 published captures and a cursor while more remain', async () => {
    const { grid, browse } = setup(Array.from({ length: 31 }, (_, i) => row(i + 1)))
    const page = await browse({ version: 'wow-forever', sort: 'recent' })
    if (!page.ok) throw new Error('refused')
    expect(page.value.items).toHaveLength(30)
    expect(grid).toHaveBeenCalledWith(
      expect.objectContaining({ gameVersion: 'wow-forever', sort: 'recent', limit: 31 }),
    )
    expect(decodeCursor('recent', page.value.nextCursor!)).toEqual({
      key: 0,
      publishedAt: row(30).publishedAt,
      id: row(30).id,
    })
    expect(page.value.items[0]).toEqual({
      id: row(1).id,
      title: 'Capture 1',
      width: 1920,
      height: 1080,
      author: { username: 'Ash' },
      zone: null,
      likes: 1,
      quality: 'poor',
      publishedAt: row(1).publishedAt,
    })
  })

  it('US-20.2 ends without a cursor on the last page', async () => {
    const { browse } = setup([row(1), row(2)])
    expect(await browse({ sort: 'recent' })).toMatchObject({ ok: true, value: { nextCursor: null } })
  })

  it('US-20.3 reads the minimum quality in the thresholds of the settings, and sorts by likes or downloads', async () => {
    const { grid, browse } = setup([row(20), row(60)])
    const page = await browse({ minQuality: 'rare', sort: 'popular', limit: 1, zone: 'stormwind', timeOfDay: 'dusk' })
    expect(grid).toHaveBeenCalledWith({
      gameVersion: undefined,
      zoneId: '0193a000-0000-7000-8000-00000000z001',
      timeOfDay: 'dusk',
      minLikes: 15,
      sort: 'popular',
      after: undefined,
      limit: 2,
    })
    if (!page.ok) throw new Error('refused')
    expect(page.value.items.map((c) => c.quality)).toEqual(['rare'])
    expect(decodeCursor('popular', page.value.nextCursor!)?.key).toBe(20)
    const next = await browse({ sort: 'popular', cursor: page.value.nextCursor! })
    expect(next.ok).toBe(true)
    expect(grid.mock.lastCall?.[0].after).toEqual({ key: 20, publishedAt: row(20).publishedAt, id: row(20).id })
    await browse({ sort: 'downloads', limit: 1 })
    expect(grid.mock.lastCall?.[0].sort).toBe('downloads')
  })

  it('US-20.4 does not find an unknown or archived version', async () => {
    const { grid, browse } = setup()
    expect(await browse({ version: 'cataclysm', sort: 'recent' })).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(grid).not.toHaveBeenCalled()
  })

  it('refuses a zone out of the dictionary and a cursor altered or made for another sort', async () => {
    const { browse } = setup([row(1), row(2)])
    expect(await browse({ zone: 'nowhere', sort: 'recent' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'zone', reason: 'unknown' },
    })
    const first = await browse({ sort: 'recent', limit: 1 })
    if (!first.ok) throw new Error('refused')
    for (const cursor of ['not-a-cursor', first.value.nextCursor!])
      expect(await browse({ sort: 'popular', cursor })).toEqual({
        ok: false,
        error: { kind: 'invalid', field: 'cursor', reason: 'unknown' },
      })
  })
})
