import type { AutoDecision, ModerationDecisionsRepository } from '../../server/modules/moderation'

/** In-memory ModerationDecisionsRepository: `rows` shows the decisions, one automatic per capture (the latest). */
export function inMemoryModerationDecisions() {
  const rows: AutoDecision[] = []
  const repo: ModerationDecisionsRepository = {
    async recordAuto(decision) {
      const index = rows.findIndex((r) => r.targetId === decision.targetId)
      if (index >= 0) rows[index] = decision
      else rows.push(decision)
    },
  }
  return { repo, rows }
}
