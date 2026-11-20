import { describe, expect, it } from 'vitest'
import { fixedClock } from '../../tests/fakes/fixed-clock'
import { uuidV7, uuidV7Generator } from './ids'

describe('UUID v7', () => {
  it('has the v7 version and RFC 9562 variant', () => {
    expect(uuidV7Generator(fixedClock('2026-11-20T12:00:00Z')).next()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('starts with the clock time in milliseconds', () => {
    const id = uuidV7(Date.parse('2026-11-20T12:00:00Z'), new Uint8Array(10))
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(Date.parse('2026-11-20T12:00:00Z'))
  })

  it('sorts in creation order across milliseconds', () => {
    const earlier = uuidV7Generator(fixedClock('2026-11-20T12:00:00.001Z')).next()
    const later = uuidV7Generator(fixedClock('2026-11-20T12:00:00.002Z')).next()
    expect([later, earlier].sort()).toEqual([earlier, later])
  })
})
