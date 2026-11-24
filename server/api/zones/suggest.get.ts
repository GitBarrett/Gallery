import { ZoneSuggestQuery, type ZoneSuggestResponse } from '../../../shared/contracts/catalog'

// Zones of the dictionary completing the Zone field (US-11.2), for every visitor (annexe B, "Lectures publiques").
export default defineEventHandler(async (event): Promise<ZoneSuggestResponse> => {
  const { q } = await getValidatedQuery(event, ZoneSuggestQuery.parse)
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return { zones: await event.context.container.catalog.suggestZones({ q }) }
})
