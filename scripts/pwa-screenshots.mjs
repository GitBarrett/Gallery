// node scripts/pwa-screenshots.mjs <photo id> — screenshots of the PWA manifest (T-32c, Q35): the home and a photo
// page, 2 `narrow` (1080 × 1920) and 2 `wide` (1920 × 1080), written to public/screenshots/ and committed; the
// manifest declares them once they exist (nuxt.config.ts). Run it against a site holding real game captures:
//   BASE_URL=https://legendaryshots.example node scripts/pwa-screenshots.mjs 0193…
// Behind Cloudflare Access (a preview), set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET as for the E2E.
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL
const photoId = process.argv[2]
if (!base || !photoId) throw new Error('usage: BASE_URL=… node scripts/pwa-screenshots.mjs <photo id>')
const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env
const headers = id && secret ? { 'cf-access-client-id': id, 'cf-access-client-secret': secret } : {}

// narrow: a phone of 360 × 640 CSS px at 3× = 1080 × 1920; wide: a 1920 × 1080 screen
const SHOTS = [
  { name: 'home-narrow', path: '/', viewport: { width: 360, height: 640 }, scale: 3 },
  { name: 'home-wide', path: '/', viewport: { width: 1920, height: 1080 }, scale: 1 },
  { name: 'photo-narrow', path: `/p/${photoId}`, viewport: { width: 360, height: 640 }, scale: 3 },
  { name: 'photo-wide', path: `/p/${photoId}`, viewport: { width: 1920, height: 1080 }, scale: 1 },
]

mkdirSync('public/screenshots', { recursive: true })
const browser = await chromium.launch()
for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    extraHTTPHeaders: headers,
  })
  const page = await context.newPage()
  await page.goto(new URL(shot.path, base).href)
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  // The cookie panel of a first visit has no place in a screenshot
  const reject = page.getByRole('button', { name: 'Reject all' })
  if (await reject.isVisible()) await reject.click()
  await page.waitForLoadState('load')
  await page.screenshot({ path: `public/screenshots/${shot.name}.jpg`, type: 'jpeg', quality: 85 })
  console.log(`public/screenshots/${shot.name}.jpg`)
  await context.close()
}
await browser.close()
