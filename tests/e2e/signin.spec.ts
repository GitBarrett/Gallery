import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Sign-in and sign-out screens (T-12b). They need the preview's test routes (invitation, counters: ADR-013) and run
// on desktop Chromium only: the sign-up and sign-in limits are shared by the CI address, and WebKit in Playwright
// runs no service worker.
const testRoute = (page: Page, path: string, method: 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

// An invited sign-up through the screen (an unverified account may sign in: Q46), made once per worker: the CI
// address has 3 sign-ups per hour, shared with signup.spec.ts running in parallel
let created: { username: string; email: string; password: string } | undefined
async function member(page: Page) {
  if (created) return created
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
  // Argon2id and the breached-password check take a few seconds on the preview
  await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible({ timeout: 15_000 })
  created = ash
  return ash
}

async function signIn(page: Page, { email, password }: { email: string; password: string }) {
  await page.waitForLoadState('networkidle') // hydrated: typing before would be lost
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
}

test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test('US-03.6 a redirect outside the site is ignored after sign-in', async ({ page }) => {
  const ash = await member(page)
  await page.goto('/signin?redirect=//evil.example')
  await signIn(page, ash)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible()
})

test('US-03.6 a visitor sent to sign in comes back to the page of the site', async ({ page }) => {
  const ash = await member(page)
  await page.goto('/settings')
  await expect(page).toHaveURL('/signin?redirect=/settings')
  await signIn(page, ash)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('US-05.3 the profile icon opens the public profile, which visitors see too', async ({ page, context }) => {
  const ash = await member(page)
  await page.goto('/signin')
  await signIn(page, ash)
  await page.getByRole('link', { name: 'My profile' }).click()
  await expect(page).toHaveURL(`/u/${ash.username}`)
  await expect(page.getByRole('heading', { level: 1, name: ash.username })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()

  await context.clearCookies() // a visitor, keeping the Access token routing of the fixture
  await page.goto(`/u/${ash.username.toUpperCase()}`)
  await expect(page.getByRole('heading', { level: 1, name: ash.username })).toBeVisible()
  await expect(page.getByText('No captures yet')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  expect((await page.goto('/u/nobody-here-at-all'))?.status()).toBe(404)
})

test('US-03.2 wrong credentials get one message', async ({ page }) => {
  await signIn(page, { email: 'nobody@example.com', password: 'not the password' })
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
})

test('US-03.4 US-64.4 sign-out ends the session and empties the pages and api-public caches', async ({ page }) => {
  const ash = await member(page)
  await page.goto('/signin')
  await signIn(page, ash)
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible()
  // A page of the member, cached by the service worker once it controls the page
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.goto('/legal')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.reload()
  const cached = () => page.evaluate(async () => (await caches.has('pages')) || (await caches.has('api-public')))
  await expect.poll(cached).toBe(true)

  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  const legalCached = () => page.evaluate(async () => Boolean(await (await caches.open('pages')).match('/legal')))
  await expect.poll(legalCached).toBe(false)
  expect(await page.evaluate(async () => (await fetch('/api/me')).status)).toBe(401)
})

test('US-03.7 US-03.8 US-03.9 lists the devices and signs out the other ones', async ({ page }) => {
  const ash = await member(page)
  await page.goto('/signin?redirect=/settings')
  await signIn(page, ash)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  // Another device: a sign-in whose cookie this browser does not keep
  const other = () =>
    page.evaluate(
      async (body) =>
        (
          await fetch('/api/auth/signin', {
            method: 'POST',
            credentials: 'omit',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status,
      { email: ash.email, password: ash.password },
    )
  expect(await other()).toBe(204)
  expect(await other()).toBe(204)
  await page.reload()

  const devices = page.getByRole('region', { name: 'Devices' })
  const items = devices.getByRole('listitem')
  await expect(items.filter({ hasText: 'This device' })).toHaveCount(1)
  const count = await items.count()
  expect(count).toBeGreaterThanOrEqual(3)
  await items.filter({ hasNotText: 'This device' }).first().getByRole('button').click()
  await expect(items).toHaveCount(count - 1)
  await devices.getByRole('button', { name: 'Sign out all other devices' }).click()
  await expect(items).toHaveCount(1)
  await expect(items).toContainText('This device')
  expect(await page.evaluate(async () => (await fetch('/api/me')).status)).toBe(200)
})

test('US-05.1 US-05.2 US-05.4 the username changes in the settings, the former profile link redirects', async ({
  page,
}) => {
  const ash = await member(page)
  await page.goto('/signin?redirect=/settings')
  await signIn(page, ash)
  const field = page.getByRole('textbox', { name: 'Username' })
  await field.fill('admin')
  await expect(page.getByText('This username is reserved. Choose another one.')).toBeVisible()
  const renamed = `e2e_n_${crypto.randomUUID().slice(0, 6)}`
  await field.fill(renamed)
  await expect(page.getByText(`“${renamed}” is available`)).toBeVisible()
  await page.getByRole('button', { name: 'Change my username' }).click()
  await expect(page.getByText(/^Username changed/)).toBeVisible() // the toast region is a status too
  const former = ash.username
  created = { ...ash, username: renamed } // the next tests of this worker sign in as the renamed member

  await page.goto(`/u/${former}`) // the 301 itself: tests/api/usernames.test.ts (the service worker hides it here)
  await expect(page).toHaveURL(`/u/${renamed}`)
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible()
})
