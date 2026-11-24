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
