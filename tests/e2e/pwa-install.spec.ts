import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { hydrated } from './helpers'

// Install invitation (T-09b). Chrome's `beforeinstallprompt` is simulated: Playwright never fires it.
const fireInstallPrompt = (page: Page) =>
  page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    window.dispatchEvent(event)
  })

// A visit is a browser session: a new tab of the same context starts one (localStorage kept, sessionStorage new)
async function visit(context: BrowserContext) {
  const page = await context.newPage()
  await page.goto('/')
  await hydrated(page)
  return page
}

const banner = (page: Page) => page.getByRole('region', { name: 'Install the app' })

test.describe('Chrome', () => {
  test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'beforeinstallprompt is Chromium only'))

  test('US-63.2 US-63.3 no invitation on the first visit, a discreet banner from the second, then 30 days of quiet once dismissed', async ({
    context,
  }) => {
    const first = await visit(context)
    await fireInstallPrompt(first)
    await expect(banner(first)).toBeHidden()

    const second = await visit(context)
    await fireInstallPrompt(second)
    await expect(banner(second)).toBeVisible()
    await banner(second).getByRole('button', { name: 'Not now' }).click()
    await expect(banner(second)).toBeHidden()

    const third = await visit(context)
    await fireInstallPrompt(third)
    await expect(banner(third)).toBeHidden()
  })
})

test.describe('Safari iOS', () => {
  test.beforeEach(({ browserName, isMobile }) => test.skip(browserName !== 'webkit' || !isMobile, 'iPhone only'))

  test('US-63.4 "Install the app" opens a sheet explaining Share → Add to Home Screen', async ({ context }) => {
    await visit(context)
    const page = await visit(context)
    await banner(page).getByRole('button', { name: 'Install the app' }).click()
    const sheet = page.getByRole('dialog', { name: 'Install on iPhone' })
    await expect(sheet).toContainText('Share')
    await expect(sheet).toContainText('Add to Home Screen')
  })
})

test('US-63.5 installed on iPhone, the app runs full screen and pads the notch and the home bar itself', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'black-translucent',
  )
  // The header and the tab bar keep the safe areas (env(safe-area-inset-*), T-07a)
  const css = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join('\n'),
  )
  expect(css).toContain('safe-area-inset-top')
  expect(css).toContain('safe-area-inset-bottom')
})
