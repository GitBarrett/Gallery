import { describe, expect, it, vi } from 'vitest'
import type { GalleryRepository, GridFilter, GridRow } from './grid'
import { viewHome, type GalleryHome, type HeroRow, type HomeSettings } from './home'
import type { PhotoRow } from './photo'

const NOW = new Date('2026-11-26T12:00:00Z')
const DAY = 86_400_000
const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const settings = (more: Partial<HomeSettings> = {}): HomeSettings => ({
  heroPhotoId: null,
  editorsPick: null,
  weekMinLikes: 10,
  thresholds,
  maxLuminance: 0.6,
  ...more,
})
const row = (id: string, likes: number, daysAgo: number): GridRow => ({
  id,
  title: `Capture ${id}`,
  width: 1920,
  height: 1080,
  username: 'Ash',
  zone: null,
  likes,
  downloads: 0,
  publishedAt: new Date(NOW.getTime() - daysAgo * DAY),
})
const hero = (id: string): HeroRow => ({
  id,
  title: 'Moonlit Path',
  width: 1920,
  height: 1080,
  focalX: 0.3,
  focalY: null,
  username: 'Lunelame',
})

// The grid queries the use case asks, as the read view does them: likes, publication date, most liked first
function setup(rows: GridRow[], s: HomeSettings, heroes: Record<string, HeroRow> = {}, pick?: PhotoRow) {
  const grid = vi.fn<GalleryRepository['grid']>(async (f: GridFilter) =>
    rows
      .filter((r) => r.likes >= f.minLikes && (!f.publishedSince || r.publishedAt >= f.publishedSince))
      .sort((a, b) => (f.sort === 'popular' ? b.likes - a.likes : 0) || +b.publishedAt - +a.publishedAt)
      .slice(0, f.limit),
  )
  const home: GalleryHome = { hero: async (id) => heroes[id ?? 'latest'] ?? null }
  return viewHome({
    repo: { grid },
    photos: { photo: async (id) => (pick?.id === id ? pick : null) },
    home,
    settings: async () => s,
    clock: { now: () => NOW },
  })
}

describe('viewHome', () => {
  it('US-24.1 shows the hero chosen by the admin, else the latest capture dark enough, else none', async () => {
    const chosen = { chosen: hero('chosen'), latest: hero('latest') }
    expect((await setup([], settings({ heroPhotoId: 'chosen' }), chosen)()).hero).toEqual({
      id: 'chosen',
      title: 'Moonlit Path',
      width: 1920,
      height: 1080,
      focalX: 0.3,
      focalY: null,
      author: { username: 'Lunelame' },
    })
    // Chosen but no more public or too bright: the latest one that is
    expect((await setup([], settings({ heroPhotoId: 'gone' }), chosen)()).hero?.id).toBe('latest')
    expect((await setup([], settings(), {})()).hero).toBeNull()
  })

  it('US-70.4 Capture of the week: the most liked of 7 days from the threshold, else of 30 days, else of all time', async () => {
    const week = await setup(
      [row('old', 90, 40), row('month', 30, 20), row('top', 12, 3), row('low', 9, 1)],
      settings(),
    )()
    expect(week.week).toMatchObject({ reason: 'week', capture: { id: 'top', quality: 'uncommon' } })
    const month = await setup([row('old', 90, 40), row('month', 30, 20), row('low', 9, 1)], settings())()
    expect(month.week).toMatchObject({ reason: 'month', capture: { id: 'month' } })
    const all = await setup([row('old', 90, 40), row('none', 0, 1)], settings())()
    expect(all.week).toMatchObject({ reason: 'all', capture: { id: 'old', quality: 'epic' } })
  })

  it("US-70.4 without any like, the Editor's pick, else no block (never a capture with 0 likes)", async () => {
    const pick = {
      id: 'pick',
      title: 'Editor pick',
      width: 1920,
      height: 1080,
      author: { username: 'Kaelys', avatarUrl: null },
      zone: null,
      likes: 0,
      publishedAt: NOW,
    } as PhotoRow
    const picked = await setup([row('none', 0, 1)], settings({ editorsPick: 'pick' }), {}, pick)()
    expect(picked.week).toMatchObject({ reason: 'pick', capture: { id: 'pick', author: { username: 'Kaelys' } } })
    expect((await setup([row('none', 0, 1)], settings())()).week).toBeNull()
  })

  it('US-24.2 lists the latest captures of every version, newest first', async () => {
    const home = await setup([row('a', 0, 2), row('b', 5, 1)], settings())()
    expect(home.latest.map((c) => c.id)).toEqual(['b', 'a'])
    expect(home.latest[0]).not.toHaveProperty('downloads')
  })
})
