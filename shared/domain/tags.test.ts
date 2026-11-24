import { describe, expect, it } from 'vitest'
import { normalizeTag, TAGS_PER_PHOTO, validateTag } from './tags'

describe('tags', () => {
  it('US-11.1 normalises a tag in lower case without accents, spaces collapsed', () => {
    expect(normalizeTag('  Hurlevent   ÉTÉ ')).toBe('hurlevent ete')
    expect(normalizeTag('Cœur de Forêt')).toBe('coeur de foret')
    expect(normalizeTag('Æther')).toBe('aether')
  })

  it('US-11.1 accepts 2 to 30 characters of letters, digits, spaces and hyphens', () => {
    expect(validateTag('Mists-of-Pandaria 2')).toEqual({ ok: true, value: 'mists-of-pandaria 2' })
    expect(validateTag(' a ')).toEqual({ ok: false, error: 'length' })
    expect(validateTag('x'.repeat(31))).toEqual({ ok: false, error: 'length' })
    expect(validateTag('x'.repeat(30))).toMatchObject({ ok: true })
    expect(validateTag('#screenshot')).toEqual({ ok: false, error: 'charset' })
    expect(validateTag('-- --')).toEqual({ ok: false, error: 'charset' })
  })

  it('US-11.1 allows 10 tags per capture', () => {
    expect(TAGS_PER_PHOTO).toBe(10)
  })
})
