import { describe, expect, it } from 'vitest'
import { shouldOfferInstall } from './install-rules'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 10, 22)

describe('install invitation (07-design.md § Invitation à l’installation)', () => {
  it('US-63.2 never on the first visit', () => {
    expect(shouldOfferInstall({ visits: 1, published: false, now })).toBe(false)
  })

  it('US-63.3 from the second visit, or after the first published capture', () => {
    expect(shouldOfferInstall({ visits: 2, published: false, now })).toBe(true)
    expect(shouldOfferInstall({ visits: 1, published: true, now })).toBe(true)
  })

  it('US-63.3 not again for 30 days once dismissed', () => {
    expect(shouldOfferInstall({ visits: 5, published: false, dismissedAt: now - 29 * DAY, now })).toBe(false)
    expect(shouldOfferInstall({ visits: 5, published: false, dismissedAt: now - 30 * DAY, now })).toBe(true)
  })
})
