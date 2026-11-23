import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// OAuth sign-in through the fake Google and Battle.net providers of the previews (its consent page is a test route, ADR-013).
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

test('US-02.1 US-02.2 US-07.4 a first Google sign-in asks for a username and the Terms, the next one signs in at once; Google cannot be unlinked as the only way in', async ({
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

  // US-07.4: an account made with Google alone, no password: unlinking Google would leave no way to sign in
  await page.goto('/settings')
  const linked = page.getByRole('region', { name: 'Linked accounts' })
  await expect(linked.getByText('Not linked')).toBeVisible() // Battle.net
  await linked.getByRole('button', { name: 'Unlink Google' }).click()
  await expect(linked.getByRole('alert')).toContainText('This is your only way to sign in')
  await page.reload()
  await expect(linked.getByRole('button', { name: 'Unlink Google' })).toBeVisible()
})

test('US-02.5 a refusal on the consent screen comes back to the sign-in with a message, Google offered again', async ({
  page,
}) => {
  await continueWithGoogle(page)
  await page.getByRole('link', { name: 'Deny' }).click()
  await expect(page).toHaveURL('/signin?oauth=failed')
  await expect(page.getByRole('alert')).toHaveText('That sign-in did not work. Try again, or use your email.')
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
})

test('US-02.6 Battle.net goes through its own consent step and comes back on a refusal, both providers offered', async ({
  page,
}) => {
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Continue with Battle.net' }).click()
  await expect(page).toHaveURL(/\/__test\/oauth\/battlenet\?/)
  await page.getByRole('link', { name: 'Deny' }).click()
  await expect(page).toHaveURL('/signin?oauth=failed')
  await expect(page.getByRole('link', { name: 'Continue with Battle.net' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
})
