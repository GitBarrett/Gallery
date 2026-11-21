import { describe, expect, it } from 'vitest'
import { failedThresholds, median } from './lighthouse-thresholds.mjs'

describe('Lighthouse thresholds (US-68.2)', () => {
  it('US-68.2 fails when Performance < 85, Accessibility < 95 or Best practices < 95', () => {
    expect(failedThresholds({ performance: 0.85, accessibility: 0.95, 'best-practices': 0.95, seo: 0.5 })).toEqual([])
    expect(failedThresholds({ performance: 0.84, accessibility: 0.94, 'best-practices': 0.9 })).toEqual([
      'performance 84 < 85',
      'accessibility 94 < 95',
      'best-practices 90 < 95',
    ])
  })

  it('treats a missing category as a failure', () => {
    expect(failedThresholds({ performance: 1, accessibility: 1 })).toEqual(['best-practices absent'])
  })

  it('keeps the median score of each category across runs', () => {
    expect(median([{ performance: 0.7 }, { performance: 0.95 }, { performance: 0.9 }])).toEqual({ performance: 0.9 })
  })
})
