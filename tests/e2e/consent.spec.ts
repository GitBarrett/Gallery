import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Cookie consent (T-10a, docs/legal/cookies.md). Every PostHog request of the test is recorded.
// CF_Authorization and CF_AppSession: Cloudflare Access, on previews only (ADR-013)
const ESSENTIAL = ['ls-consent', 'i18n_redirected', 'CF_Authorization', 'CF_AppSession']
const posthogCalls = (page: Page) => {
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('posthog')) calls.push(request.url())
  })
  return calls
}
const panel = (page: Page) => page.getByRole('region', { name: 'Your cookie choices' })
const cookieNames = async (context: BrowserContext) => (await context.cookies()).map((c) => c.name)

async function open(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForLoadState('networkidle') // hydrated
}

test('US-61.1 on a first visit, no PostHog script and a panel with Accept all, Reject all and Customise of equal weight', async ({
  page,
}) => {
  const calls = posthogCalls(page)
  await open(page)
  const buttons = panel(page).getByRole('button')
  await expect(buttons).toHaveText(['Accept all', 'Reject all', 'Customise'])
  const looks = await buttons.evaluateAll((elements) =>
    elements.map((e) => {
      const style = getComputedStyle(e)
      return [style.backgroundColor, style.color, style.borderColor, style.fontWeight, e.clientHeight].join()
    }),
  )
  expect(new Set(looks).size).toBe(1)
  expect(calls).toEqual([])
})

test('US-61.2 US-72.2 after refusing, browsing leaves no non-essential cookie or storage and sends nothing to PostHog', async ({
  page,
  context,
}) => {
  const calls = posthogCalls(page)
  await open(page)
  await panel(page).getByRole('button', { name: 'Reject all' }).click()
  await expect(panel(page)).toBeHidden()
  await open(page, '/fr')
  await expect(page.getByRole('region', { name: 'Vos choix de cookies' })).toBeHidden()
  expect((await cookieNames(context)).filter((name) => !ESSENTIAL.includes(name))).toEqual([])
  const storage = await page.evaluate(() => Object.keys(localStorage).filter((key) => /posthog|ph_/.test(key)))
  expect(storage).toEqual([])
  expect(calls).toEqual([])
})

test('US-61.4 "Cookie settings" in the footer changes the choice; withdrawing removes the analytics cookie', async ({
  page,
  context,
}) => {
  await open(page)
  await panel(page).getByRole('button', { name: 'Accept all' }).click()
  expect(await cookieNames(context)).toContain('ls-analytics-id')

  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your cookie choices' })
  const analytics = dialog.getByRole('switch', { name: /Product analytics/ })
  await expect(analytics).toBeChecked()
  await analytics.uncheck()
  await dialog.getByRole('button', { name: 'Save choices' }).click()
  await expect(dialog).toBeHidden()
  expect(await cookieNames(context)).not.toContain('ls-analytics-id')
})
