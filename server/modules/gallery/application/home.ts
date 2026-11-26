import type { QualityThresholds } from '../../../../shared/domain/quality'
import { qualityFromLikes } from '../../../../shared/domain/quality'
import type { Clock } from '../../../platform/clock'
import { toGridCapture, type GalleryRepository, type GridCapture } from './grid'
import type { GalleryPhotos, PhotoRow } from './photo'

/** The capture behind the hero of the home, with its focal point (US-13.2) to crop it. */
export interface HeroRow {
  id: string
  title: string
  width: number
  height: number
  focalX: number | null
  focalY: number | null
  username: string
}

/** Port: the hero of the home in the read view. */
export interface GalleryHome {
  /** This public capture if dark enough at the bottom left, else null; without an id, the latest one that is. */
  hero(photoId: string | null, maxLuminance: number): Promise<HeroRow | null>
}

/** What the home reads in site_settings (US-24.1, US-70.4). */
export interface HomeSettings {
  heroPhotoId: string | null
  editorsPick: string | null
  weekMinLikes: number
  thresholds: QualityThresholds
  maxLuminance: number // 07 § Hero: white text stays readable on luma_bl ≤ 0,6
}

export type WeekReason = 'week' | 'month' | 'all' | 'pick'

/** Captures of the « Latest captures » grid of the home (US-24.2), every version. */
export const HOME_LATEST = 30
const DAY = 86_400_000

const fromPhoto = (row: PhotoRow, thresholds: QualityThresholds): GridCapture => ({
  id: row.id,
  title: row.title,
  width: row.width,
  height: row.height,
  author: { username: row.author.username },
  zone: row.zone,
  likes: row.likes,
  quality: qualityFromLikes(row.likes, thresholds),
  publishedAt: row.publishedAt,
})

const toHero = ({ username, ...hero }: HeroRow) => ({ ...hero, author: { username } })

type Deps = {
  repo: GalleryRepository
  photos: GalleryPhotos
  home: GalleryHome
  settings: () => Promise<HomeSettings>
  clock: Clock
}

/**
 * « Capture of the week » (US-70.4, 07 § Aucun bloc vide): the most liked one published within 7 days with at least
 * `weekMinLikes`, else within 30 days, else of all time (at least one like: never a block showing 0), else the
 * Editor's pick, else no block. shortcut: likes have no date until T-40, so a window is on the publication date and
 * the likes counter; T-40 makes them likes of the window.
 */
async function captureOfTheWeek(deps: Deps, s: HomeSettings) {
  const now = deps.clock.now().getTime()
  const steps: { reason: WeekReason; since?: Date; minLikes: number }[] = [
    { reason: 'week', since: new Date(now - 7 * DAY), minLikes: s.weekMinLikes },
    { reason: 'month', since: new Date(now - 30 * DAY), minLikes: 1 },
    { reason: 'all', minLikes: 1 },
  ]
  for (const step of steps) {
    const [row] = await deps.repo.grid({
      sort: 'popular',
      minLikes: step.minLikes,
      publishedSince: step.since,
      limit: 1,
    })
    if (row) return { reason: step.reason, capture: toGridCapture(s.thresholds)(row) }
  }
  const pick = s.editorsPick ? await deps.photos.photo(s.editorsPick) : null
  return pick ? { reason: 'pick' as const, capture: fromPhoto(pick, s.thresholds) } : null
}

/**
 * The home (US-24.1, US-24.2; public read, annexe B): the hero chosen by the admin (site_settings `home.hero`), or —
 * not chosen yet, no more public, or too bright for the text — the latest public capture dark enough, or none;
 * « Capture of the week » with its fallbacks; the latest captures of every version.
 */
export const viewHome = (deps: Deps) => async () => {
  const s = await deps.settings()
  const hero =
    (s.heroPhotoId ? await deps.home.hero(s.heroPhotoId, s.maxLuminance) : null) ??
    (await deps.home.hero(null, s.maxLuminance))
  const latest = await deps.repo.grid({ sort: 'recent', minLikes: 0, limit: HOME_LATEST })
  return {
    hero: hero && toHero(hero),
    week: await captureOfTheWeek(deps, s),
    latest: latest.map(toGridCapture(s.thresholds)),
  }
}
