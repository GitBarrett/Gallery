/** Fewest pixels of a horizontal swipe; below, a tap or a scroll. */
export const SWIPE_MIN = 50

/**
 * The capture a swipe asks for (US-67.2): to the left, the next one; to the right, the previous one. A short move, or
 * one more vertical than horizontal (the page scrolling), asks for nothing.
 */
export function swipeDirection(dx: number, dy: number): 'next' | 'prev' | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 1.5 * Math.abs(dy)) return null
  return dx < 0 ? 'next' : 'prev'
}
