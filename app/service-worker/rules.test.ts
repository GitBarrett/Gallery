import { describe, expect, it } from 'vitest'
import { cacheRule, offlinePage } from './rules'

const rule = (path: string, request: { method?: string; mode?: string; sameOrigin?: boolean } = {}) =>
  cacheRule(new URL(path, 'https://legendary.test'), {
    method: request.method ?? 'GET',
    mode: request.mode ?? 'cors',
    sameOrigin: request.sameOrigin ?? true,
  })

describe('service worker rules (03-architecture.md § PWA)', () => {
  it('US-64.2 public navigations go network first into the pages cache, private and OAuth ones network only', () => {
    for (const path of ['/', '/fr', '/explore', '/fr/explore', '/u/jaina'])
      expect(rule(path, { mode: 'navigate' }), path).toBe('pages')
    for (const path of [
      '/settings',
      '/fr/settings/email',
      '/admin/moderation',
      '/notifications',
      '/upload',
      '/fr/upload',
      '/auth/google',
      '/auth/google/callback',
      '/fr/oauth/complete',
    ])
      expect(rule(path, { mode: 'navigate' }), path).toBe('network')
  })

  it('caches public API reads only, never private reads, mutations or other origins', () => {
    for (const path of [
      '/api/photos?cursor=x',
      '/api/photos/1',
      '/api/users/jaina/photos',
      '/api/home',
      '/api/search?q=sw',
    ])
      expect(rule(path), path).toBe('api-public')
    for (const path of ['/api/me', '/api/me/photos', '/api/notifications', '/api/zones/suggest?q=s', '/api/health'])
      expect(rule(path), path).toBe('network')
    expect(rule('/api/photos', { method: 'POST' })).toBe('network')
    expect(rule('/api/photos', { sameOrigin: false })).toBe('network')
  })

  it('leaves display images to T-25b and every other request to the network', () => {
    expect(rule('/img/1/800')).toBe('network')
    expect(rule('/storybook/index.html', { mode: 'navigate' })).toBe('network')
  })

  it('US-64.2 falls back on the offline page of the language of the URL', () => {
    expect(offlinePage('/explore')).toBe('/offline')
    expect(offlinePage('/fr/explore')).toBe('/fr/offline')
    expect(offlinePage('/fr')).toBe('/fr/offline')
    expect(offlinePage('/french-toast')).toBe('/offline')
  })
})
