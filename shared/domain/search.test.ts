import { describe, expect, it } from 'vitest'
import { MAX_QUERY, normalizeQuery, tagCandidates } from './search'

describe('search query', () => {
  it('US-21.7 removes control characters and cuts a query over 100 characters, without refusing it', () => {
    expect(normalizeQuery('Storm\u0000wind\u0007 \n City')).toBe('storm wind city')
    const long = normalizeQuery('a'.repeat(150))
    expect(long).toHaveLength(MAX_QUERY)
  })

  it('US-21.4 searches the form of the zone names: lower case, no accents, single spaces', () => {
    expect(normalizeQuery('  Hurlevent  ')).toBe('hurlevent')
    expect(normalizeQuery('Val’sharah Éclat')).toBe('val’sharah eclat')
  })

  it('US-21.1 looks for a tag in the whole query and in each word', () => {
    expect(tagCandidates('night market')).toEqual(['night market', 'night', 'market'])
    expect(tagCandidates('x')).toEqual([])
  })
})
