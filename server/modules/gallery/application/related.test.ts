import { describe, expect, it } from 'vitest'
import type { GalleryRepository, GridFilter, GridRow } from './grid'
import { relatedPhotos, type PhotoContext } from './related'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
type Stored = GridRow & { userId: string; zoneId: string | null; version: string }
let n = 0
const capture = (more: Partial<Stored>): Stored => {
  n++
  return {
    id: `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    title: `Capture ${n}`,
    width: 1920,
    height: 1080,
    username: 'Ash',
    zone: null,
    likes: 0,
    downloads: 0,
    publishedAt: new Date(Date.UTC(2026, 10, 25, 10, n)),
    userId: 'ash',
    zoneId: null,
    version: 'wow-forever',
    ...more,
  }
}

// The grid filters the use case asks, newest first, as the read view does them
function setup(shown: Stored, others: Stored[]) {
  const all = [shown, ...others]
  const repo: GalleryRepository = {
    grid: async (f: GridFilter) =>
      all
        .filter((r) => !f.authorId || r.userId === f.authorId)
        .filter((r) => !f.zoneId || r.zoneId === f.zoneId)
        .filter((r) => !f.gameVersion || r.version === f.gameVersion)
        .filter((r) => !f.exclude?.includes(r.id))
        .sort((a, b) => +b.publishedAt - +a.publishedAt)
        .slice(0, f.limit),
  }
  const context: PhotoContext = {
    id: shown.id,
    userId: shown.userId,
    zoneId: shown.zoneId,
    gameVersion: shown.version,
    publishedAt: shown.publishedAt,
  }
  const related = relatedPhotos({
    repo,
    related: {
      context: async (id) => (id === shown.id ? context : null),
      neighbours: async () => ({ prev: 'newer-id', next: 'older-id' }),
    },
    thresholds: async () => thresholds,
  })
  return async () => {
    const result = await related({ id: shown.id })
    if (!result.ok) throw new Error('not found')
    return result.value
  }
}
const ids = (sections: { kind: string; items: { id: string }[] }[]) =>
  sections.map((s) => [s.kind, s.items.map((i) => i.id)])

describe('relatedPhotos', () => {
  it('US-67.2 gives the previous and next captures of the version', async () => {
    const shown = capture({})
    expect(await setup(shown, [])()).toMatchObject({ prev: 'newer-id', next: 'older-id' })
  })

  it('US-70.1 shows 2 other captures of the author or more, the newest 4, never the one shown', async () => {
    const shown = capture({})
    const mine = [1, 2, 3, 4, 5].map(() => capture({}))
    const value = await setup(shown, [...mine, capture({ userId: 'jaina' })])()
    expect(ids(value.sections)).toEqual([['author', [mine[4]!.id, mine[3]!.id, mine[2]!.id, mine[1]!.id]]])
    expect(value.sections[0]!.items[0]).toMatchObject({ author: { username: 'Ash' }, quality: 'poor' })
  })

  it('US-70.1 completes a single other capture with similar ones, same zone first then same version, up to 4', async () => {
    const shown = capture({ zoneId: 'nagrand' })
    const mine = capture({})
    const zone = capture({ userId: 'jaina', zoneId: 'nagrand', version: 'retail' })
    const version = [1, 2, 3].map(() => capture({ userId: 'jaina' }))
    const value = await setup(shown, [mine, zone, ...version])()
    expect(ids(value.sections)).toEqual([
      ['author', [mine.id]],
      ['similar', [zone.id, version[2]!.id, version[1]!.id]],
    ])
  })

  it('US-70.2 without other capture of the author: the same zone, else the latest of the version, else no block', async () => {
    const inZone = capture({ zoneId: 'nagrand' })
    const neighbour = capture({ userId: 'jaina', zoneId: 'nagrand', version: 'retail' })
    expect(ids((await setup(inZone, [neighbour])()).sections)).toEqual([['zone', [neighbour.id]]])

    const alone = capture({ zoneId: 'ashenvale' })
    const latest = capture({ userId: 'jaina' })
    expect(ids((await setup(alone, [latest, capture({ userId: 'jaina', version: 'retail' })])()).sections)).toEqual([
      ['latest', [latest.id]],
    ])

    expect((await setup(capture({}), [capture({ userId: 'jaina', version: 'retail' })])()).sections).toEqual([])
  })

  it('does not find a capture that is not public', async () => {
    const related = relatedPhotos({
      repo: { grid: async () => [] },
      related: { context: async () => null, neighbours: async () => ({ prev: null, next: null }) },
      thresholds: async () => thresholds,
    })
    expect(await related({ id: 'x' })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})
