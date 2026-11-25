import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { hydrated } from './helpers'

// PWA (T-09a): Chromium only (WebKit in Playwright runs no service worker); the service worker only exists in
// production builds (previews), so these tests are skipped against `pnpm dev`.
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'service workers are tested in Chromium')
})

// Fetched by the page itself: its requests carry the Access service token (fixtures.ts), unlike `request`
const fetchInPage = (page: Page, url: string) =>
  page.evaluate(async (url) => {
    const response = await fetch(url)
    return { status: response.status, type: response.headers.get('content-type') ?? '', body: await response.text() }
  }, url)

async function controlledHome(page: Page) {
  await page.goto('/')
  // Skipped only when the build has no service worker (pnpm dev); otherwise it must register
  const sw = await fetchInPage(page, '/sw.js')
  test.skip(sw.status !== 200 || !sw.type.includes('javascript'), 'no service worker outside production builds')
  await page.evaluate(() => navigator.serviceWorker.ready) // registration happens after load, then activation
  await page.reload() // the active service worker now controls the page and has cached it
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

test('US-63.1 the app is installable: manifest with name, colours, maskable icons, shortcuts and a service worker', async ({
  page,
}) => {
  await controlledHome(page)
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = JSON.parse((await fetchInPage(page, href!)).body)
  expect(manifest).toMatchObject({
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    name: 'Legendary Shots',
    short_name: 'Legendary',
    display: 'standalone',
    theme_color: '#0B0E14',
    background_color: '#0B0E14',
  })
  const icons = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes} ${i.purpose ?? 'any'}`)
  expect(icons).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable', '512x512 monochrome']),
  )
  for (const icon of manifest.icons) expect((await fetchInPage(page, icon.src)).type).toBe('image/png')
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/upload', '/search', '/notifications'])
})

test('US-62.1 once the service worker has precached the offline pages, an English visitor stays in English', async ({
  page,
}) => {
  await controlledHome(page) // active service worker: its install, which precaches /offline and /fr/offline, is done
  await page.goto('/')
  await expect(page).toHaveURL('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('US-64.2 offline, a page never visited shows /offline with the pages available', async ({ page, context }) => {
  await controlledHome(page)
  await context.setOffline(true)
  await page.goto('/never-visited')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're offline")
  await expect(page.getByRole('main').getByRole('link', { name: '/', exact: true })).toBeVisible()
})

// Independent of the service worker: with a page it controls, Playwright's offline emulation fires no `offline` event
test('US-64.3 offline, a banner says so', async ({ page, context }) => {
  await page.goto('/')
  await hydrated(page)
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeHidden()
})
