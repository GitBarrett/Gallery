import { sql } from 'drizzle-orm'
import type { Db, Transaction } from '../../../db/client'
import { moderationDecisions } from '../../../db/schema'
import type { ModerationDecisionsRepository } from '../application/ports'

export const drizzleModerationDecisions = (db: Db | Transaction): ModerationDecisionsRepository => ({
  async recordAuto({ targetType = 'photo', targetId, decision, scores, reason }) {
    // One automatic decision per capture (partial unique index): a replay replaces it, the latest one is applied
    await db
      .insert(moderationDecisions)
      .values({ targetType, targetId, decision, source: 'auto', scores, reason })
      .onConflictDoUpdate({
        target: [moderationDecisions.targetType, moderationDecisions.targetId],
        targetWhere: sql`${moderationDecisions.source} = 'auto'`,
        set: { decision, scores, reason, createdAt: sql`now()` },
      })
  },
})
