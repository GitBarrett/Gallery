import { createRequire } from 'node:module'
import { expect, test } from './fixtures'
import { post, testRoute, verifiedMember } from './members'

// Quest log (T-23b): a verified member gets notifications from a test route (the events that create them arrive with
// their tasks), sees the bell's counter, the Today / Earlier groups and marks everything read. Needs the preview's
// test routes; desktop Chromium only (sign-up limits shared by the CI address), then 360 px on the same member.
const axePath = createRequire(import.meta.url).resolve('axe-core')

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up and its email through the queue (a few seconds): longer than the default 30 s
test.describe.configure({ timeout: 120_000 })

test('US-35.3 groups the Quest log Today / Earlier, unread in yellow, and « Mark all as read » works', async ({
  page,
}) => {
  await verifiedMember(page)
  expect((await post(page, '/__test/notifications', {})).status).toBe(204)
  await page.goto('/notifications')

  // US-35.1: the bell's counter, read on load
  const bell = page.getByRole('banner').getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications 2 unread')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quest log')
  const today = page.getByRole('region', { name: 'Today' })
  const earlier = page.getByRole('region', { name: 'Earlier' })
  await expect(today.getByRole('listitem')).toHaveCount(2)
  await expect(today.getByRole('img', { name: 'Unread' })).toHaveCount(2)
  await expect(today).toContainText('started following you.')
  await expect(today).toContainText('Your new avatar was rejected by moderation.')
  await expect(earlier.getByRole('img', { name: 'Read' })).toHaveCount(1)

  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const { violations } = await (window as unknown as { axe: typeof import('axe-core') }).axe.run()
    return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
  })
  expect(violations).toEqual([])

  await page.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByRole('img', { name: 'Unread' })).toHaveCount(0)
  await expect(bell).toHaveAccessibleName('Notifications')
  await page.reload()
  await expect(page.getByRole('img', { name: 'Read' })).toHaveCount(3)

  // 360 px: no horizontal scroll, the tab bar takes the bell
  await page.setViewportSize({ width: 360, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await expect(
    page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Notifications' }),
  ).toBeVisible()
})
