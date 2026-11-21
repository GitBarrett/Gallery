// Lighthouse thresholds of US-68.2 (03-architecture.md § Budgets de performance), as scores out of 100.
// PWA installability is no longer measured by Lighthouse 12+: checked by an E2E test of the manifest (Q27, T-09a).
const THRESHOLDS = { performance: 85, accessibility: 95, 'best-practices': 95 }

/** Readable unmet thresholds; a missing category counts as a failure. */
export function failedThresholds(scores) {
  return Object.entries(THRESHOLDS).flatMap(([category, min]) => {
    if (typeof scores[category] !== 'number') return [`${category} absent`]
    const score = Math.round(scores[category] * 100)
    return score < min ? [`${category} ${score} < ${min}`] : []
  })
}

/** Median score of each category over several runs. */
export function median(runs) {
  return Object.fromEntries(
    Object.keys(runs[0]).map((category) => {
      const sorted = runs.map((run) => run[category]).sort((a, b) => a - b)
      return [category, sorted[Math.floor(sorted.length / 2)]]
    }),
  )
}
