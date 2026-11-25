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

/**
 * A 1600 × 900 JPEG drawn in the page, uploaded and completed as the form does, then waited for until the queue and
 * the fake moderation publish it (a title without `_nsfw` / `_review`). The member must be verified. Returns its id.
 */
export async function publishCapture(
  page: Page,
  capture: { title: string; gameVersion: string } & Record<string, unknown>, // + the details of CompleteUploadBody
) {
  const photoId = await page.evaluate(async (details) => {
    const canvas = new OffscreenCanvas(1600, 900)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3d566e'
    context.fillRect(0, 0, 1600, 900)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    const json = { 'content-type': 'application/json' }
    const declared = { contentType: blob.type, bytes: blob.size, width: 1600, height: 900 }
    const asked = await fetch('/api/photos/upload-url', {
      method: 'POST',
      headers: json,
      body: JSON.stringify(declared),
    })
    const { photoId: id, url } = await asked.json()
    await fetch(url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })
    await fetch(`/api/photos/${id}/complete`, { method: 'POST', headers: json, body: JSON.stringify(details) })
    return id as string
  }, capture)
  await expect
    .poll(async () => (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body?.status, { timeout: 120_000 })
    .toBe('published')
  return photoId
}
