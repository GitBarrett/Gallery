// Seuils Lighthouse de US-68.2 (03-architecture.md § Budgets de performance), en score sur 100.
// L'installabilité PWA n'est plus mesurée par Lighthouse 12+ : vérifiée par un test E2E du manifest (Q27, T-09a).
const THRESHOLDS = { performance: 85, accessibility: 95, 'best-practices': 95 }

/** Seuils non atteints, lisibles ; une catégorie absente compte comme un échec. */
export function failedThresholds(scores) {
  return Object.entries(THRESHOLDS).flatMap(([category, min]) => {
    if (typeof scores[category] !== 'number') return [`${category} absent`]
    const score = Math.round(scores[category] * 100)
    return score < min ? [`${category} ${score} < ${min}`] : []
  })
}

/** Score médian de chaque catégorie sur plusieurs passages. */
export function median(runs) {
  return Object.fromEntries(
    Object.keys(runs[0]).map((category) => {
      const sorted = runs.map((run) => run[category]).sort((a, b) => a - b)
      return [category, sorted[Math.floor(sorted.length / 2)]]
    }),
  )
}
