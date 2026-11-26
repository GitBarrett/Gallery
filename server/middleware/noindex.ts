// Previews must never be indexed (ADR-013); everywhere, the private pages of a member (and their /fr versions) are not
// indexed either (US-25, Q97): their content is the visitor's own, or a form.
const PRIVATE =
  /^(\/fr)?\/(settings|upload|my-captures|notifications|signin|signup|reset|verify-email|confirm-email|oauth|offline)(\/|$)/

export default defineEventHandler((event) => {
  if (event.context.container.config.deployEnv === 'preview')
    setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  else if (PRIVATE.test(getRequestURL(event).pathname)) setResponseHeader(event, 'x-robots-tag', 'noindex')
})
