import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Forgotten password (T-13b): sign-in page → request → email in the preview's fake mailbox (/__test/mailbox) →
// new password → the other sessions are ended. Desktop only, a single sign-up: the CI address has 3 sign-ups per
// hour, shared with the other specs.
const testRoute = (page: Page, path: string, method: 'GET' | 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

// Token of the reset link last mailed to `email` (the emails queue takes a moment)
async function mailedResetToken(page: Page, email: string) {
  let token: string | undefined
  await expect
    .poll(
      async () => {
        const { body } = await testRoute(page, `/__test/mailbox?to=${encodeURIComponent(email)}`, 'GET')
        token = body?.text.match(/\/reset#([\w-]+)/)?.[1]
        return token !== undefined
      },
      { timeout: 60_000 },
    )
    .toBe(true)
  return token!
}

const meStatus = (page: Page) => page.evaluate(async () => (await fetch('/api/me')).status)

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up, a sign-in and an email through the queue: longer than the default 30 s
test.describe.configure({ timeout: 120_000 })

test('US-04.1 US-04.2 US-04.3 the mailed link sets a new password, ends the other sessions, then works no more', async ({
  page,
  context,
}) => {
  const run = crypto.randomUUID().slice(0, 8)
  const ash = { username: `e2e_${run}`, email: `e2e.${run}@example.com`, password: `a long passphrase ${run}` }
  const { body } = await testRoute(page, '/__test/invite', 'POST')
  await page.goto(`/signup?invite=${body.token}`)
  const create = page.getByRole('button', { name: 'Create my account' })
  await expect(create).toBeEnabled({ timeout: 15_000 }) // hydrated, test Turnstile passed
  await page.getByLabel('Username').fill(ash.username)
  await page.getByLabel('Email').fill(ash.email)
  await page.getByLabel('Password').fill(ash.password)
  await page.getByRole('checkbox', { name: /at least 15/ }).check()
  await create.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible({ timeout: 15_000 })

  // A session on "another device", kept aside
  await page.goto('/signin')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(ash.email)
  await page.getByLabel('Password').fill(ash.password)
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible({ timeout: 15_000 }) // Argon2id: seconds
  const otherDevice = await context.cookies()

  // US-04.1: "Forgot password?" on the sign-in page, the same answer whatever the email
  await context.clearCookies()
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL('/reset')
  const send = page.getByRole('button', { name: 'Send reset link' })
  await expect(send).toBeEnabled({ timeout: 15_000 })
  await page.getByLabel('Email').fill(ash.email)
  await send.click()
  await expect(page.getByRole('status').filter({ hasText: 'if this email is registered' })).toBeVisible()
  const token = await mailedResetToken(page, ash.email)

  // US-04.3: the new password signs in here and ends the session of the other device
  const password = `a brand new passphrase ${run}`
  await page.goto('/') // a new document: from /reset, changing the fragment alone would not reload
  await page.goto(`/reset#${token}`)
  await page.getByRole('textbox', { name: 'New password' }).fill(password)
  await page.getByRole('button', { name: 'Change my password' }).click()
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible({ timeout: 15_000 }) // Argon2id: seconds
  await expect(page).toHaveURL('/') // the token left the address bar
  const signedIn = await context.cookies()
  await context.clearCookies()
  await context.addCookies(otherDevice)
  expect(await meStatus(page)).toBe(401)
  await context.clearCookies()
  await context.addCookies(signedIn)
  expect(await meStatus(page)).toBe(200)

  // US-04.2: the link is then refused, with a way to ask for a new one
  await page.goto(`/reset#${token}`)
  await page.getByRole('textbox', { name: 'New password' }).fill(`yet another passphrase ${run}`)
  await page.getByRole('button', { name: 'Change my password' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'already used' })).toBeVisible()
  await page.getByRole('button', { name: 'Get a new link' }).click()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
})
