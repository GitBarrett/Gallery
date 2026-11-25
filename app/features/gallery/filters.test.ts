import { describe, expect, it } from 'vitest'
import { readFilters, writeFilters } from './filters'

describe('gallery filters in the URL', () => {
  it('US-20.3 writes the filters to the query string and reads the same filters back', () => {
    const filters = { zone: 'stormwind', timeOfDay: 'dusk', minQuality: 'rare', sort: 'popular' } as const
    const query = writeFilters(filters)
    expect(query).toEqual({ zone: 'stormwind', time: 'dusk', quality: 'rare', sort: 'popular' })
    expect(readFilters(query)).toEqual(filters)
  })

  it('US-20.3 leaves the defaults out of the URL and ignores an unknown value', () => {
    expect(writeFilters({ minQuality: 'poor', sort: 'recent' })).toEqual({})
    expect(readFilters({ time: 'noon', quality: 'mythic', sort: 'random', zone: '../x' })).toEqual({
      zone: undefined,
      timeOfDay: undefined,
      minQuality: undefined,
      sort: undefined,
    })
    expect(readFilters({ time: ['night', 'dawn'] }).timeOfDay).toBe('night') // repeated: the first one
  })
})
