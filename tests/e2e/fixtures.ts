import { test as base, type Route } from '@playwright/test'

// Previews behind Cloudflare Access (T-03d): the service token is only added to requests for the tested site,
// never to third parties (Web Analytics, Sentry). Without a token (local, public production), nothing is added.
// Specs import `test` from here rather than from @playwright/test.
const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env

/** Headers of an intercepted request, with the Access service token when there is one. */
export const withAccess = (route: Route) => ({
  ...route.request().headers(),
  ...(id && secret && { 'cf-access-client-id': id, 'cf-access-client-secret': secret }),
})

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    if (id && secret && baseURL)
      await context.route(`${new URL(baseURL).origin}/**`, (route) => route.continue({ headers: withAccess(route) }))
    await use(context)
  },
})
export { expect } from '@playwright/test'
