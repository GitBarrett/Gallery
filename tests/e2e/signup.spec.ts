import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { hydrated, submitAndWait } from './helpers'

// Sign-up screen (T-11c). Submissions need the preview's test routes (invitations, counters: ADR-013) and run on
// desktop only: the 3 sign-ups per hour and per IP are shared by every project of the CI run.
async function testRoute(page: Page, path: string, method: 'POST' | 'DELETE') {
  const response = await page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )
  return response
}

async function fill(page: Page, { username, email, password }: { username: string; email: string; password: string }) {
  // Test site key: the check passes by itself once the page is hydrated (typing before would be lost)
  await hydrated(page)
  const submit = page.getByRole('button', { name: 'Create my account' })
  await expect(submit).toBeEnabled({ timeout: 15_000 })
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('checkbox', { name: /at least 15/ }).check()
}

const someone = () => {
  const run = crypto.randomUUID().slice(0, 8)
  return { username: `e2e_${run}`, email: `e2e.${run}@example.com`, password: `a long passphrase ${run}` }
}

test('US-01 the sign-up form shows its labelled fields (axe, keyboard and 360 px: layout.spec.ts)', async ({
  page,
}) => {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible()
  for (const label of ['Username', 'Email', 'Password']) await expect(page.getByLabel(label)).toBeVisible()
})

test.describe('submissions', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the sign-up limits are shared by the CI address')
    await page.goto('/signup')
    const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
    test.skip(reset.status === 404, 'test routes are only built for previews')
  })

  test('US-01.7 a sign-up whose Terms box is not checked is not sent', async ({ page }) => {
    await fill(page, someone())
    await page.getByRole('checkbox', { name: /at least 15/ }).uncheck()
    await page.getByRole('button', { name: 'Create my account' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible()
    expect(
      await page.getByRole('checkbox', { name: /at least 15/ }).evaluate((box: HTMLInputElement) => box.validity.valid),
    ).toBe(false)
  })

  test('US-01.1 US-01.2 an invited sign-up ends on "Check your inbox", the same for an email already used', async ({
    page,
  }) => {
    const ash = someone()
    for (const username of [ash.username, `${ash.username}x`]) {
      const { body } = await testRoute(page, '/__test/invite', 'POST')
      await page.goto(`/signup?invite=${body.token}`)
      await fill(page, { ...ash, username })
      await submitAndWait(page, page.getByRole('button', { name: 'Create my account' }), '/api/auth/signup')
      await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible()
    }
  })

  test('US-56.4 without invitation, the sign-up is refused with the waiting list form', async ({ page }) => {
    await fill(page, someone())
    await submitAndWait(page, page.getByRole('button', { name: 'Create my account' }), '/api/auth/signup')
    await expect(page.getByRole('heading', { level: 1, name: 'Join the waiting list' })).toBeVisible()
    // the form renders again once Turnstile mounts: a tick before that is lost, so tick until it holds
    const consent = page.getByRole('checkbox', { name: /receive an email/ })
    await expect(async () => {
      await consent.check()
      await expect(consent).toBeChecked({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    const join = page.getByRole('button', { name: 'Join the waiting list' })
    await expect(join).toBeEnabled({ timeout: 15_000 })
    await submitAndWait(page, join, '/api/waitlist')
    await expect(page.getByRole('heading', { level: 1, name: "You're on the list" })).toBeVisible()
  })
})
