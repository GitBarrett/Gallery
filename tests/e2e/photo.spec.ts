import { expect, test } from './fixtures'
import { expectImageLoaded, hydrated } from './helpers'
import { publishCapture, testRoute, verifiedMember } from './members'

// Photo page (T-31c) on the preview: a capture published through the real pipeline, reached from its grid. It uses
// Retail: the grids of Classic Era (gallery.spec.ts) must not get a capture at dawn. Desktop Chromium only (sign-up
// limits, test routes).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test.describe.configure({ timeout: 180_000 })

test('US-25.1 US-71.2 the photo page shows the capture as an item, its quality, and its head for robots', async ({
  page,
}) => {
  await verifiedMember(page)
  const title = `Photo ${crypto.randomUUID().slice(0, 8)}`
  const id = await publishCapture(page, {
    title,
    gameVersion: 'retail',
    zone: 'nagrand',
    inGameTime: '06:10',
    characterName: 'Ysolde',
    caption: 'First light on the plains.',
    tags: ['dawn', 'plains'],
  })

  // From the grid of its version
  await page.goto('/v/retail')
  await page.getByRole('article').filter({ hasText: title }).getByRole('link').click()
  await expect(page).toHaveURL(`/p/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeAttached()
  const details = page.getByRole('complementary')
  await expect(details).toContainText('Poor capture · Retail')
  await expect(details).toContainText('Nagrand · 06:10 in-game')
  await expect(details).toContainText('Character: Ysolde')
  await expect(details).toContainText('1600 × 900 · JPEG')
  await expect(details).toContainText('First light on the plains.')
  await expect(details.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText(['#dawn', '#plains'])
  await expectImageLoaded(page.locator('figure img'))

  // US-71.2: the badge tells its threshold and the likes to the next tier, on hover as on a touch
  await hydrated(page)
  await page.getByRole('button', { name: 'Poor' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Poor · new capture · 3 likes to Uncommon')

  // US-25.1: the HTML of the server, as a robot gets it (fetched from the page: Cloudflare Access)
  const origin = new URL(page.url()).origin
  const head = await page.evaluate(async (path) => {
    const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), 'text/html')
    const meta = (name: string) =>
      doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')
    const ld = doc.querySelector('script[type="application/ld+json"]')?.textContent
    return {
      title: doc.title,
      description: meta('description'),
      ogImage: meta('og:image'),
      twitterCard: meta('twitter:card'),
      canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      fr: doc.querySelector('link[hreflang="fr"]')?.getAttribute('href'),
      imageObject: ld ? JSON.parse(ld) : null,
      og: (await fetch(`/img/${path.split('/').at(-1)}/og.jpg`)).headers.get('content-type'),
    }
  }, `/p/${id}`)
  expect(head).toMatchObject({
    title: `${title} — Retail`,
    description: 'First light on the plains.',
    ogImage: `${origin}/img/${id}/og.jpg`,
    twitterCard: 'summary_large_image',
    canonical: `${origin}/p/${id}`,
    fr: `${origin}/fr/p/${id}`,
    imageObject: { '@type': 'ImageObject', name: title, license: `${origin}/terms` },
    og: 'image/jpeg',
  })

  // A capture that is not public, or none, is the 404 page
  expect((await page.goto(`/p/${crypto.randomUUID()}`))?.status()).toBe(404)
})
