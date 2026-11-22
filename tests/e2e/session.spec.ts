import { expect, test } from './fixtures'

// Sessions (T-12a): the sign-in screens come with T-12b. Checks that the deployed Worker can unseal a session
// cookie, so that NUXT_APP_SECRET reached it (without it, reading the cookie fails with 500). Through the page:
// only its requests carry the Access token of the previews (fixtures.ts), not the `request` fixture.
test('US-03.5 an unreadable session cookie is answered 401', async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser is enough for an API check')
  await context.addCookies([{ name: '__Host-ls-session', value: 'forged', url: baseURL!, secure: true }])
  const response = await page.goto('/api/me')
  expect(response?.status()).toBe(401)
})
