import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// OAuth sign-in through the fake Google provider of the previews (its consent page is a test route, ADR-013).
// Desktop Chromium only, one account creation per run: the sign-up limit is shared by the CI address.
test.describe.configure({ timeout: 120_000 })

const testRoute = (page: Page, path: string, method: 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

async function continueWithGoogle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Continue with Google' }).click()
  await expect(page).toHaveURL(/\/__test\/oauth\/google\?/)
}

test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test('US-02.1 US-02.2 a first Google sign-in asks for a username and the Terms, the next one signs in at once', async ({
  page,
  context,
}) => {
  const run = crypto.randomUUID().slice(0, 8)
  const email = `e2e.oauth.${run}@example.com`
  const { body } = await testRoute(page, '/__test/invite', 'POST')
  await page.goto(`/signup?invite=${body.token}`)
  await continueWithGoogle(page)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Allow' }).click()

  await expect(page).toHaveURL('/oauth/complete')
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your username' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Username' }).fill(`e2e_g_${run}`)
  await page.getByRole('checkbox', { name: /at least 15/ }).check()
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible()

  await context.clearCookies() // a new browser
  await page.goto('/signin')
  await continueWithGoogle(page)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Allow' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible()
})

test('US-02.5 a refusal on the consent screen comes back to the sign-in with a message, Google offered again', async ({
  page,
}) => {
  await continueWithGoogle(page)
  await page.getByRole('link', { name: 'Deny' }).click()
  await expect(page).toHaveURL('/signin?oauth=failed')
  await expect(page.getByRole('alert')).toHaveText('Signing in with Google did not work. Try again, or use your email.')
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
})
