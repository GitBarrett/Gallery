import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Upload request (T-21), before its screen (T-26a): from the page, as the form will do it, a verified member gets a
// presigned URL, PUTs the file straight to the private R2 bucket (CORS of infra/r2-cors.preview.json, R2 host in
// connect-src) and completes. Needs the preview's test routes and its S3 token; desktop Chromium only (sign-up limits).
const testRoute = (page: Page, path: string, method: 'GET' | 'POST' | 'DELETE') =>
  page.evaluate(
    async ([url, verb]) => {
      const r = await fetch(url!, { method: verb })
      return { status: r.status, body: r.status === 200 ? await r.json() : null }
    },
    [path, method],
  )

const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(
    async ([url, json]) => {
      const r = await fetch(url!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json })
      return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }
    },
    [path, JSON.stringify(body)],
  )

// Signs up a member through the API, then opens the mailed link: verified and signed in
async function verifiedMember(page: Page) {
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

// PUT of `bytes` bytes through the presigned URL; 0 when the browser blocks the answer (CORS, CSP)
const put = (page: Page, url: string, bytes: number) =>
  page.evaluate(
    async ([target, size]) => {
      const body = new Blob([new Uint8Array(size as number)], { type: 'image/png' })
      try {
        return (await fetch(target as string, { method: 'PUT', headers: { 'content-type': 'image/png' }, body })).status
      } catch {
        return 0
      }
    },
    [url, bytes] as const,
  )

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up and its email through the queue (a few seconds): longer than the default 30 s
test.describe.configure({ timeout: 120_000 })

test('US-10.1 US-10.6 the browser puts the file straight into the private bucket, then completes', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await verifiedMember(page)
  const file = { contentType: 'image/png', bytes: 2048, width: 1920, height: 1080 }

  const first = await post(page, '/api/photos/upload-url', file)
  expect(first.status).toBe(200)
  expect(await put(page, first.body.url, file.bytes)).toBe(200)
  const completed = await post(page, `/api/photos/${first.body.photoId}/complete`, {
    title: 'Dusk over Elwynn',
    gameVersion: 'wow-forever',
  })
  expect(completed).toEqual({ status: 200, body: { photoId: first.body.photoId, status: 'processing' } })

  // US-10.6: another size than declared is refused by R2 or, failing that, by complete
  const second = await post(page, '/api/photos/upload-url', file)
  await put(page, second.body.url, file.bytes + 1)
  const refused = await post(page, `/api/photos/${second.body.photoId}/complete`, {
    title: 'Dusk',
    gameVersion: 'wow-forever',
  })
  expect(refused.status).toBe(422) // reason missing (refused by R2) or size (accepted, then deleted)
  expect(violations).toEqual([])
})
