import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Waits shared by the specs (CI analysis of 25/11/2026: 20 failed runs were tests that did not wait for the right
// thing). ESLint refuses the old forms in tests/e2e (eslint.config.mjs).

/** The app is hydrated (app/plugins/hydrated.client.ts): typing or clicking before would be lost. */
export const hydrated = (page: Page) => expect(page.locator('html[data-hydrated]')).toBeAttached({ timeout: 30_000 })

/**
 * Clicks `button` and waits for the answer of `apiPath` (a password step takes seconds on a preview: Argon2id and the
 * breached-password check), so that the assertions after it keep the default timeout. Returns the response.
 */
export async function submitAndWait(page: Page, button: Locator, apiPath: string) {
  const answered = page.waitForResponse(
    (r) => new URL(r.url()).pathname === apiPath && r.request().method() !== 'GET',
    {
      timeout: 30_000,
    },
  )
  await button.click()
  return answered
}

/** An image the browser loaded and decoded, checked from the page: a bare request is answered by Cloudflare Access. */
export const expectImageLoaded = (image: Locator) =>
  expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0)
