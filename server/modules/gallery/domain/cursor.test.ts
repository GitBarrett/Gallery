import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor } from './cursor'

const at = { key: 12, publishedAt: new Date('2026-11-25T10:00:00.000Z'), id: '0193a000-0000-7000-8000-0000000000a1' }

describe('grid cursor', () => {
  it('US-20.1 gives back the position of the last capture of a page, for its own sort only', () => {
    const cursor = encodeCursor('popular', at)
    expect(cursor).toMatch(/^[\w-]+$/) // safe in a URL
    expect(decodeCursor('popular', cursor)).toEqual(at)
    expect(decodeCursor('recent', cursor)).toBeNull()
  })

  it('refuses an altered cursor', () => {
    for (const cursor of [
      '',
      'x',
      btoa('[1,2]'),
      encodeCursor('recent', at).slice(0, -3),
      btoa('["recent",1.5,"2026-11-25T10:00:00Z","x"]'),
    ])
      expect(decodeCursor('recent', cursor), cursor).toBeNull()
  })
})
