import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Email verification screen (T-11f): sign-up → email in the preview's fake mailbox (/__test/mailbox) → link →
// signed in. Desktop only, a single sign-up: the CI address has 3 sign-ups per hour, shared with the other specs.
const testRoute = (page: Page, path: string, method: 'GET' | 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

// Token of the last link mailed to `email`, once it differs from `previous` (the emails queue takes a moment)
async function mailedToken(page: Page, email: string, previous?: string) {
  let token: string | undefined
  await expect
    .poll(
      async () => {
        const { body } = await testRoute(page, `/__test/mailbox?to=${encodeURIComponent(email)}`, 'GET')
        token = body?.text.match(/\/verify-email#([\w-]+)/)?.[1]
        return token !== undefined && token !== previous
      },
      { timeout: 60_000 },
    )
    .toBe(true)
  return token!
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test('US-01.1 US-01.4 US-01.5 the mailed link verifies the email and signs in, once; a member asks for a new one', async ({
  page,
  context,
}) => {
  const run = crypto.randomUUID().slice(0, 8)
  const ash = { username: `e2e_${run}`, email: `e2e.${run}@example.com`, password: `a long passphrase ${run}` }
  const { body } = await testRoute(page, '/__test/invite', 'POST')
  await page.goto(`/signup?invite=${body.token}`)
  const submit = page.getByRole('button', { name: 'Create my account' })
  await expect(submit).toBeEnabled({ timeout: 15_000 }) // hydrated, test Turnstile passed
  await page.getByLabel('Username').fill(ash.username)
  await page.getByLabel('Email').fill(ash.email)
  await page.getByLabel('Password').fill(ash.password)
  await page.getByRole('checkbox', { name: /at least 15/ }).check()
  await submit.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible({ timeout: 15_000 })
  const first = await mailedToken(page, ash.email)

  // US-01.5: signed in before verifying (Q46), a member whose link does not work asks for a new one
  await page.goto('/signin')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(ash.email)
  await page.getByLabel('Password').fill(ash.password)
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible()
  await page.goto('/verify-email#not-a-token')
  await expect(page.getByRole('alert').filter({ hasText: 'This link is not valid' })).toBeVisible()
  const resend = page.getByRole('button', { name: 'Resend' })
  await expect(resend).toBeEnabled({ timeout: 15_000 })
  await resend.click()
  await expect(page.getByRole('status').filter({ hasText: 'New link sent' })).toBeVisible()
  await mailedToken(page, ash.email, first)

  // US-01.1 US-01.4: as a visitor, the first link (still valid, Q46) verifies the email, signs in, opens the profile
  await context.clearCookies()
  await page.goto('/') // a new document: from /verify-email, changing the fragment alone would not reload
  await page.goto(`/verify-email#${first}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page).toHaveURL('/settings') // the token left the address bar
  const me = await page.evaluate(async () => (await fetch('/api/me')).json())
  expect(me.emailVerified).toBe(true)

  // US-01.4: the link is then unusable
  await page.goto(`/verify-email#${first}`)
  await expect(page.getByRole('alert').filter({ hasText: 'This link is not valid' })).toBeVisible()
})
