import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollback } from '../../../../tests/db'
import { moderationDecisions } from '../../../db/schema'
import { drizzleModerationDecisions } from './drizzle-moderation-decisions'

describe('drizzleModerationDecisions', () => {
  it('US-50.6 records the automatic decision of a capture with its raw scores, one per capture (US-14.2)', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleModerationDecisions(tx)
      const targetId = crypto.randomUUID()
      await repo.recordAuto({ targetId, decision: 'pending_review', scores: null, reason: 'provider_unavailable' })
      // Replay after a failed status write: the latest decision replaces the first
      await repo.recordAuto({ targetId, decision: 'rejected', scores: { nudity: { erotica: 0.9 } }, reason: null })
      const rows = await tx.select().from(moderationDecisions).where(eq(moderationDecisions.targetId, targetId))
      expect(rows).toEqual([
        expect.objectContaining({
          targetType: 'photo',
          decision: 'rejected',
          source: 'auto',
          moderatorId: null,
          reason: null,
          scores: { nudity: { erotica: 0.9 } },
        }),
      ])
    })
  })
})
