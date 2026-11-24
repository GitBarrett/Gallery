import { TagSuggestQuery, type TagSuggestResponse } from '../../../shared/contracts/catalog'

// Existing tags completing what the member types (US-11.1), for every visitor (annexe B, "Lectures publiques").
export default defineEventHandler(async (event): Promise<TagSuggestResponse> => {
  const { q } = await getValidatedQuery(event, TagSuggestQuery.parse)
  setResponseHeader(event, 'cache-control', 'public, max-age=60, stale-while-revalidate=300')
  return { tags: await event.context.container.catalog.suggestTags({ q }) }
})
