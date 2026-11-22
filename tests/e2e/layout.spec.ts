import { createRequire } from 'node:module'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Shared layout (T-07a). shortcut: extend PAGES as pages are added; the privacy page holds the widest table.
const PAGES = ['/', '/privacy', '/terms', '/signup']
const INTERACTIVE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
const axePath = createRequire(import.meta.url).resolve('axe-core')

async function seriousAxeViolations(page: Page) {
  await page.addScriptTag({ path: axePath })
  return page.evaluate(async () => {
    const { violations } = await (window as unknown as { axe: typeof import('axe-core') }).axe.run()
    return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
  })
}

test('US-67.1 below 768 px, the main navigation is a bottom tab bar with Upload in the centre', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const tabBar = page.getByRole('navigation', { name: 'Main' })
  await expect(tabBar.getByRole('link')).toHaveText(['Explore', 'Search', 'Upload', 'Notifications', 'Profile'])
  const box = (await tabBar.boundingBox())!
  expect(box.y + box.height).toBeCloseTo(844, 0)
})

test('US-67.5 every interactive element has a touch target of at least 44 × 44 px', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path)
    const small = await page.locator(INTERACTIVE).evaluateAll((elements) =>
      elements
        // A checkbox is touched through its whole label
        .map((element) => ({
          element,
          box: (element.matches('[type=checkbox]')
            ? (element.closest('label') ?? element)
            : element
          ).getBoundingClientRect(),
        }))
        .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
        .map(({ element, box }) => `${element.outerHTML.slice(0, 60)} ${box.width}×${box.height}`),
    )
    expect(small, path).toEqual([])
  }
})

test('US-67.6 no horizontal scroll at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of PAGES) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('US-75.1 skip link first, every element reachable by keyboard with a visible focus', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard navigation is checked on desktop')
  for (const path of PAGES) {
    await page.goto(path)
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('Skip to content')
    await page.keyboard.press('Enter')
    await expect(page.locator(':focus')).toHaveAttribute('id', 'content')

    await page.goto(path)
    await page.keyboard.press('Tab')
    const reachable = await page
      .locator(INTERACTIVE)
      .evaluateAll((all) => all.filter((e) => e.checkVisibility()).length)
    const withoutFocusRing: string[] = []
    for (let i = 1; i < reachable; i++) {
      await page.keyboard.press('Tab')
      // The search field shows its ring on its frame (the form); the Turnstile frame draws its own, inside
      const missing = await page.evaluate(() => {
        const e = document.activeElement
        if (!e || e.tagName === 'IFRAME') return null
        const shadow = getComputedStyle(e.closest('form[role=search]') ?? e).boxShadow
        return shadow === 'none' ? e.outerHTML.slice(0, 60) : null
      })
      if (missing) withoutFocusRing.push(missing)
    }
    expect(withoutFocusRing, path).toEqual([])
    expect(await seriousAxeViolations(page), path).toEqual([])
  }
})

test('US-75.4 transitions are neutralised with prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const duration = await page.getByRole('banner').evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))
  expect(duration).toBeLessThan(0.001)
})
