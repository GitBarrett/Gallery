import { describe, expect, it, vi } from 'vitest'
import { decodeCursor } from '../domain/cursor'
import { authorCaptures } from './author'
import type { GalleryRepository, GridFilter, GridRow } from './grid'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const row = (n: number): GridRow => ({
  id: `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
  title: `Capture ${n}`,
  width: 1920,
  height: 1080,
  username: 'Ash',
  zone: null,
  likes: n * 10,
  downloads: 0,
  publishedAt: new Date(Date.UTC(2026, 10, 25, 10, n)),
})

describe('authorCaptures', () => {
  it('US-05.3 lists the public captures of a profile by its username, newest first, by pages', async () => {
    const rows = [row(3), row(2), row(1)]
    const grid = vi.fn<GalleryRepository['grid']>(async (f: GridFilter) => rows.slice(0, f.limit))
    const list = authorCaptures({ repo: { grid }, thresholds: async () => thresholds })
    const first = await list({ username: 'ash', limit: 2 })
    if (!first.ok) throw new Error('refused')
    expect(grid).toHaveBeenCalledWith({
      authorUsername: 'ash',
      minLikes: 0,
      sort: 'recent',
      after: undefined,
      limit: 3,
    })
    expect(first.value.items.map((c) => [c.title, c.quality])).toEqual([
      ['Capture 3', 'rare'],
      ['Capture 2', 'rare'],
    ])
    expect(decodeCursor('recent', first.value.nextCursor!)).toMatchObject({ id: row(2).id })
    await list({ username: 'ash', limit: 2, cursor: first.value.nextCursor! })
    expect(grid.mock.lastCall?.[0].after).toMatchObject({ id: row(2).id })
    expect(await list({ username: 'ash', cursor: 'bad' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'cursor', reason: 'unknown' },
    })
  })
})
