import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_VERSION, needsChoice, useAnalytics, useConsent } from './useConsent'

const DAY = 24 * 3600 * 1000
const now = Date.UTC(2026, 10, 22)

describe('needsChoice', () => {
  it('US-61.3 asks again after 6 months or when a category is added', () => {
    expect(needsChoice(null, now)).toBe(true)
    expect(needsChoice({ v: CONSENT_VERSION, analytics: false, at: now - 180 * DAY }, now)).toBe(false)
    expect(needsChoice({ v: CONSENT_VERSION, analytics: false, at: now - 184 * DAY }, now)).toBe(true)
    expect(needsChoice({ v: CONSENT_VERSION - 1, analytics: true, at: now }, now)).toBe(true)
  })
})

describe('useAnalytics', () => {
  const fetchMock = vi.fn(async () => new Response('{}'))
  vi.stubGlobal('fetch', fetchMock)
  beforeEach(() => {
    useRuntimeConfig().public.posthogKey = 'phc_test'
  })
  afterEach(() => fetchMock.mockClear())

  it('US-72.1 with analytics accepted, an event goes to PostHog EU with a pseudonymous id only', async () => {
    useConsent().choose(true)
    await nextTick()
    useAnalytics()('photo_liked', { quality: 'epic' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      api_key: 'phc_test',
      event: 'photo_liked',
      distinct_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      properties: { quality: 'epic' },
    })
  })

  it('US-72.2 US-61.4 with analytics refused or withdrawn, no event is sent and the id cookie is removed', async () => {
    useConsent().choose(true)
    await nextTick()
    useConsent().choose(false)
    await nextTick()
    expect(useCookie('ls-analytics-id').value).toBeFalsy()
    useAnalytics()('photo_liked')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
