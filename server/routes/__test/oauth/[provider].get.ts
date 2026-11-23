import { z } from 'zod'
import { OAuthProviderParams } from '../../../../shared/contracts/auth'

const Query = z.object({ state: z.string().regex(/^[\w-]{1,256}$/) })

// Preview only (excluded from other builds, nuxt.config.ts): consent page of the fake OAuth providers. "Allow"
// sends the typed email back as the code (fakeOAuthProvider), "Deny" the provider's refusal (US-02.5).
export default defineEventHandler(async (event) => {
  const { provider } = await getValidatedRouterParams(event, OAuthProviderParams.parse)
  const { state } = await getValidatedQuery(event, Query.parse)
  const callback = `/auth/${provider}/callback`
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!doctype html><html lang="en"><title>Fake ${provider}</title>
<form action="${callback}"><input type="hidden" name="state" value="${state}">
<label>Email <input name="code" required></label> <button>Allow</button></form>
<a href="${callback}?error=access_denied&amp;state=${state}">Deny</a></html>`
})
