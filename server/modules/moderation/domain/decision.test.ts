import { describe, expect, it } from 'vitest'
import { decide } from './decision'

const launch = { review: 0.5, reject: 0.85 }

describe('decide', () => {
  it('US-50.1 rejects from the high threshold', () => {
    expect(decide(0.85, launch)).toBe('rejected')
    expect(decide(0.99, launch)).toBe('rejected')
  })

  it('US-50.2 sends to review between the low and the high threshold', () => {
    expect(decide(0.5, launch)).toBe('pending_review')
    expect(decide(0.8499, launch)).toBe('pending_review')
  })

  it('US-50.3 publishes under the low threshold', () => {
    expect(decide(0.4999, launch)).toBe('published')
    expect(decide(0, launch)).toBe('published')
  })

  it('US-50.4 sends to review when the provider did not answer', () => {
    expect(decide(null, launch)).toBe('pending_review')
  })

  it('US-50.5 follows the thresholds it is given', () => {
    expect(decide(0.6, { review: 0.7, reject: 0.9 })).toBe('published')
    expect(decide(0.6, { review: 0.3, reject: 0.55 })).toBe('rejected')
  })
})
