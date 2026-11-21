import { test as base } from '@playwright/test'

// Previews derrière Cloudflare Access (T-03d) : le jeton de service n'est ajouté qu'aux requêtes vers le site testé,
// jamais vers les tiers (Web Analytics, Sentry). Sans jeton (local, production publique), rien n'est ajouté.
// Les specs importent `test` d'ici plutôt que de @playwright/test.
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
