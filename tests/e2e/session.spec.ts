import { expect, test } from './fixtures'

// Sessions (T-12a): the sign-in screens come with T-12b. Checks that the deployed Worker can unseal a session
// cookie, so that NUXT_APP_SECRET reached it (without it, reading the cookie fails with 500).
test('US-03.5 an unreadable session cookie is answered 401 and deleted', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser is enough for an API check')
  const response = await request.get('/api/me', { headers: { cookie: '__Host-ls-session=forged' } })
  expect(response.status()).toBe(401)
})
