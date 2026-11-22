import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('US-03.6 ignores a redirect that points outside the site', () => {
    for (const outside of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/%2F%2Fevil.example',
      'javascript:alert(1)',
      'settings',
      '',
      undefined,
      ['/settings'],
    ])
      expect(safeRedirect(outside)).toBe('/')
  })

  it('US-03.6 keeps a relative path of the site, with its query', () => {
    expect(safeRedirect('/fr/settings?tab=sessions')).toBe('/fr/settings?tab=sessions')
  })
})
