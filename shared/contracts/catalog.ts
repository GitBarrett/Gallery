import { z } from './zod'

/** GET /api/game-versions: versions not archived, in display order, names in both languages (02 § Galerie). */
export const GameVersionsResponse = z.strictObject({
  versions: z.array(z.strictObject({ slug: z.string(), nameEn: z.string(), nameFr: z.string() })),
})
export type GameVersionsResponse = z.infer<typeof GameVersionsResponse>

/** GET /api/tags/suggest?q=: what the member typed (US-11.1). */
export const TagSuggestQuery = z.strictObject({ q: z.string().max(100) })

/** Up to 10 existing tags, normalised, alphabetical. */
export const TagSuggestResponse = z.strictObject({ tags: z.array(z.string()) })
export type TagSuggestResponse = z.infer<typeof TagSuggestResponse>

/** GET /api/zones/suggest?q=: what the member typed in the Zone field (US-11.2). */
export const ZoneSuggestQuery = z.strictObject({ q: z.string().max(100) })

/** Up to 10 zones of the dictionary, closest first, names in both languages (US-62.4). */
export const ZoneSuggestResponse = z.strictObject({
  zones: z.array(z.strictObject({ slug: z.string(), nameEn: z.string(), nameFr: z.string() })),
})
export type ZoneSuggestResponse = z.infer<typeof ZoneSuggestResponse>
