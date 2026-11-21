import { describe, expect, it } from 'vitest'
import { fixedWindow } from './rate-limiter'

describe('fixedWindow', () => {
  it('aligns the window on its size and gives the time left until the next one', () => {
    expect(fixedWindow(new Date('2026-11-21T12:40:00.000Z'), 3600)).toEqual({
      start: new Date('2026-11-21T12:00:00.000Z'),
      retryAfterSeconds: 1200,
    })
  })

  it('starts a new window exactly on the boundary', () => {
    expect(fixedWindow(new Date('2026-11-21T13:00:00.000Z'), 3600).start).toEqual(new Date('2026-11-21T13:00:00.000Z'))
  })

  it('never asks to retry in less than one second', () => {
    expect(fixedWindow(new Date('2026-11-21T12:59:59.999Z'), 3600).retryAfterSeconds).toBe(1)
  })
})
