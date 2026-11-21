import * as Sentry from '@sentry/nuxt'

// Sentry côté navigateur (T-03f) : aucune donnée personnelle (ni utilisateur, ni cookies, ni corps, ni query) ;
// inactif sans DSN (local, tests).
const { sentryDsn } = useRuntimeConfig().public
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false, httpHeaders: false },
    tracesSampleRate: 0.1,
  })
  // Rapport des violations CSP (08-securite.md § 5), sans la query de l'URL bloquée
  document.addEventListener('securitypolicyviolation', (e) =>
    Sentry.captureMessage(`CSP: ${e.effectiveDirective} blocked ${e.blockedURI.split('?')[0]}`, 'warning'),
  )
}
