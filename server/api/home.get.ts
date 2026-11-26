import type { HomeResponse } from '../../shared/contracts/photos'
import type { GridCapture } from '../modules/gallery'

// The home (US-24.1, US-24.2, US-70.4), for every visitor (annexe B, "Lectures publiques"); cached at the edge
// (03 § API).
const asJson = (c: GridCapture) => ({ ...c, publishedAt: c.publishedAt.toISOString() })

export default defineEventHandler(async (event): Promise<HomeResponse> => {
  const { hero, week, latest } = await event.context.container.gallery.viewHome()
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    hero,
    week: week && { reason: week.reason, capture: asJson(week.capture) },
    latest: latest.map(asJson),
  }
})
