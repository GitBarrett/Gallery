import * as Sentry from '@sentry/nuxt'

// Browser Sentry (T-03f): no personal data (no user, cookies, bodies or query);
// inactive without a DSN (local, tests).
const { sentryDsn } = useRuntimeConfig().public
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false, httpHeaders: false },
    tracesSampleRate: 0.1,
  })
  // CSP violation reports (08-securite.md § 5), without the query of the blocked URL
  document.addEventListener('securitypolicyviolation', (e) =>
    Sentry.captureMessage(`CSP: ${e.effectiveDirective} blocked ${e.blockedURI.split('?')[0]}`, 'warning'),
  )
}
