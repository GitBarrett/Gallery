// Cookie choice (US-61, docs/legal/cookies.md): one strictly necessary cookie `ls-consent`, kept 6 months. Bump
// CONSENT_VERSION when an optional category is added (advertising, v1.x): everyone is asked again (US-61.3).
export const CONSENT_VERSION = 1
const SIX_MONTHS = 183 * 24 * 3600 // seconds
const YEAR = 365 * 24 * 3600

export interface Consent {
  v: number
  analytics: boolean
  at: number // epoch ms
}

export function needsChoice(consent: Consent | null | undefined, now: number) {
  return !consent || consent.v !== CONSENT_VERSION || now - consent.at > SIX_MONTHS * 1000
}

const consentCookie = () => useCookie<Consent | null>('ls-consent', { maxAge: SIX_MONTHS, sameSite: 'lax' })
// Pseudonymous analytics id (US-72.1): a random UUID, only while analytics is accepted (12 months, cookies.md)
const analyticsId = () => useCookie<string | null>('ls-analytics-id', { maxAge: YEAR, sameSite: 'lax' })

export function useConsent() {
  const consent = consentCookie()
  const panelOpen = useState('consent-panel', () => false)
  function choose(analytics: boolean) {
    consent.value = { v: CONSENT_VERSION, analytics, at: Date.now() }
    const id = analyticsId()
    id.value = analytics ? (id.value ?? crypto.randomUUID()) : null // null deletes the cookie (withdrawal)
    panelOpen.value = false
  }
  return { consent, pending: computed(() => needsChoice(consent.value, Date.now())), panelOpen, choose }
}

/** Events of 03-architecture.md § Analytics, each sent by its own feature. */
export type AnalyticsEvent =
  | 'signup'
  | 'login'
  | 'photo_uploaded'
  | 'photo_published'
  | 'photo_liked'
  | 'comment_posted'
  | 'photo_shared'
  | 'photo_downloaded'
  | 'user_followed'
  | 'collection_created'
  | 'report_submitted'
  | 'bug_reported'

/**
 * PostHog EU capture API called directly (no SDK: no third-party script, no autocapture). Nothing leaves without
 * analytics consent (US-72.2); never put an email or a username in `properties` (08-securite.md).
 */
export function useAnalytics() {
  const { posthogKey } = useRuntimeConfig().public
  return (event: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}) => {
    const distinctId = analyticsId().value
    if (!posthogKey || !consentCookie().value?.analytics || !distinctId) return
    fetch('https://eu.i.posthog.com/i/v0/e/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: posthogKey, event, distinct_id: distinctId, properties }),
      keepalive: true, // finishes even if the page navigates away
    }).catch(() => {}) // a lost event is acceptable
  }
}
