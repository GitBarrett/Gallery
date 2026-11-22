import { test as base } from '@playwright/test'

// Previews behind Cloudflare Access (T-03d): the service token is only added to requests for the tested site,
// never to third parties (Web Analytics, Sentry). Without a token (local, public production), nothing is added.
// Specs import `test` from here rather than from @playwright/test.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env
    if (id && secret && baseURL)
      await context.route(`${new URL(baseURL).origin}/**`, (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'cf-access-client-id': id, 'cf-access-client-secret': secret },
        }),
      )
    await use(context)
  },
})
export { expect } from '@playwright/test'
