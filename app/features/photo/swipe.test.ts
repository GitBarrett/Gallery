import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

describe('swipeDirection', () => {
  it('US-67.2 a swipe to the left asks for the next capture, to the right for the previous one', () => {
    expect(swipeDirection(-80, 10)).toBe('next')
    expect(swipeDirection(120, -20)).toBe('prev')
  })

  it('US-67.2 a short or mostly vertical move (a tap, the page scrolling) asks for nothing', () => {
    expect(swipeDirection(-30, 0)).toBeNull()
    expect(swipeDirection(-80, 70)).toBeNull()
    expect(swipeDirection(0, -300)).toBeNull()
  })
})
