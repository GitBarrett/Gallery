import { describe, expect, it } from 'vitest'
import { cacheRule, IMG_CACHE, offlinePage } from './rules'

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
    for (const path of [
      '/api/me',
      '/api/me/photos',
      '/api/notifications',
      '/api/zones/suggest?q=s',
      '/api/health',
      '/api/photos/1/like', // US-30.1: the member's own state
    ])
      expect(rule(path), path).toBe('network')
    expect(rule('/api/photos', { method: 'POST' })).toBe('network')
    expect(rule('/api/photos', { sameOrigin: false })).toBe('network')
  })

  const id = '0193a000-0000-7000-8000-0000000000aa'
  it('US-64.1 keeps the display images up to 1200 px in the img cache', () => {
    for (const width of ['400', '800', '1200']) expect(rule(`/img/${id}/${width}`)).toBe('img')
  })

  it('US-64.5 never stores the 2400 px variant, the og:image, a private preview, an original or a malformed path', () => {
    expect(rule(`/img/${id}/2400`)).toBe('network')
    expect(rule(`/img/${id}/og.jpg`)).toBe('network')
    expect(rule(`/img/${id}/800?preview=1`)).toBe('network')
    expect(rule(`/img/${id}/800`, { sameOrigin: false })).toBe('network') // R2 and any other origin
    expect(rule('/img/1/800')).toBe('network')
    expect(rule('/storybook/index.html', { mode: 'navigate' })).toBe('network')
  })

  it('US-64.6 drops the oldest image beyond 300, after 30 days at most', () => {
    expect(IMG_CACHE).toEqual({ maxEntries: 300, maxAgeSeconds: 2_592_000 })
  })

  it('US-14.4 never caches « My captures », a private page', () => {
    expect(rule('/my-captures', { mode: 'navigate' })).toBe('network')
    expect(rule('/fr/my-captures', { mode: 'navigate' })).toBe('network')
  })

  it('US-64.2 falls back on the offline page of the language of the URL', () => {
    expect(offlinePage('/explore')).toBe('/offline')
    expect(offlinePage('/fr/explore')).toBe('/fr/offline')
    expect(offlinePage('/fr')).toBe('/fr/offline')
    expect(offlinePage('/french-toast')).toBe('/offline')
  })
})
