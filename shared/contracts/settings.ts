import { z } from './zod'

const Count = z.number().int().min(1)
const Flag = z.boolean()

/** GET /api/settings/public: values the interface needs before any sign-in. */
export const PublicSettings = z.strictObject({
  qualityThresholds: z.strictObject({ uncommon: Count, rare: Count, epic: Count, legendary: Count }),
  features: z.strictObject({
    contests: Flag,
    follows: Flag,
    collections: Flag,
    leaderboard: Flag,
    ads: Flag,
    donations: Flag,
    readonly: Flag,
    inviteOnly: Flag,
  }),
})
export type PublicSettings = z.infer<typeof PublicSettings>
