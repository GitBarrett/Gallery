import type { Page } from '@playwright/test'
import { expect } from './fixtures'

// Members of the specs that upload (T-21, T-22b): test routes and API calls made from the page, as the site does.

export const testRoute = (page: Page, path: string, method: 'GET' | 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

export const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(
    async ([url, json]) => {
      const r = await fetch(url!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json })
      return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }
    },
    [path, JSON.stringify(body)],
  )

// Signs up a member through the API, then opens the mailed link: verified and signed in
export async function verifiedMember(page: Page) {
  const run = crypto.randomUUID().slice(0, 8)
  const email = `e2e.${run}@example.com`
  const { body: invite } = await testRoute(page, '/__test/invite', 'POST')
  const signup = await post(page, '/api/auth/signup', {
    email,
    username: `e2e_${run}`,
    password: `a long passphrase ${run}`,
    termsAccepted: true,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    inviteToken: invite.token,
  })
  expect(signup.status).toBe(204)
  let token: string | undefined
  await expect
    .poll(
      async () => {
        const { body } = await testRoute(page, `/__test/mailbox?to=${encodeURIComponent(email)}`, 'GET')
        token = body?.text.match(/\/verify-email#([\w-]+)/)?.[1]
        return token
      },
      { timeout: 60_000 },
    )
    .toBeTruthy()
  expect((await post(page, '/api/auth/verify-email', { token })).status).toBe(204)
}
