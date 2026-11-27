import { expect, test } from './fixtures'
import { expectImageLoaded, hydrated } from './helpers'
import { post, publishCapture, testRoute, verifiedMember } from './members'

// Photo page (T-31c) on the preview: a capture published through the real pipeline, reached from its grid. It uses
// Retail: the grids of Classic Era (gallery.spec.ts) must not get a capture at dawn. Desktop Chromium only (sign-up
// limits, test routes).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up, then two captures through the queue
test.describe.configure({ timeout: 240_000 })

// US-32.2: the head for robots is the preview of a shared link (1200 px image, title, author)
test('US-25.1 US-32.2 US-71.2 the photo page shows the capture as an item, its quality, and its head for robots', async ({
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
  // A newer capture of the same member: the previous one of the first, and its « More from »
  const newer = await publishCapture(page, {
    title: `Neighbour ${crypto.randomUUID().slice(0, 8)}`,
    gameVersion: 'retail',
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

  // US-67.2: the newer capture of the version is the previous one (a retry leaves older captures: no check of « next »)
  const nav = page.getByRole('navigation', { name: 'Captures of the version' })
  await expect(nav.getByRole('link', { name: 'Previous capture' })).toHaveAttribute('href', `/p/${newer}`)
  // US-70.1: a single other capture of the author, in the block (no similar capture in this fresh version)
  const block = page.getByRole('region', { name: /^More from / })
  await expect(block.getByRole('link')).toHaveAttribute('href', `/p/${newer}`)
  await expectImageLoaded(block.getByRole('img'))
  // The arrow keys go from one to the other
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(`/p/${newer}`)
  await hydrated(page)
  await expect(nav.getByRole('link', { name: 'Next capture' })).toHaveAttribute('href', `/p/${id}`)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(`/p/${id}`)

  // A capture that is not public, or none, is the 404 page
  expect((await page.goto(`/p/${crypto.randomUUID()}`))?.status()).toBe(404)
})

test('US-30.1 US-30.2 US-30.4 a member likes and unlikes a capture, its author cannot, a visitor signs in', async ({
  page,
}) => {
  const author = await verifiedMember(page)
  const id = await publishCapture(page, { title: `Like ${crypto.randomUUID().slice(0, 8)}`, gameVersion: 'retail' })
  // The author: the button is disabled on their own capture
  await page.goto(`/p/${id}`)
  await hydrated(page)
  await expect(page.getByRole('button', { name: /^Like/ })).toBeDisabled()
  await expect(page.getByText("You can't like your own capture.")).toBeVisible()
  expect((await post(page, '/api/auth/signout', {})).status).toBe(204)

  // A visitor is sent to sign in, back to the page
  await page.goto(`/p/${id}`)
  await hydrated(page)
  await page.getByRole('button', { name: /^Like/ }).click()
  await page.waitForURL(/\/signin\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(`/p/${id}`)

  // Another member likes it, still liked after a reload, then unlikes it
  await verifiedMember(page)
  await page.goto(`/p/${id}`)
  await hydrated(page)
  const like = page.getByRole('button', { name: /^Like/ })
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(like).toContainText('1')
  await page.reload()
  await hydrated(page)
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await expect(like).toContainText('0')
  expect(author.email).toBeTruthy()
})

test('US-31.1 US-31.3 US-31.4 US-31.6 a comment with an XSS payload shows as text, edited then deleted', async ({
  page,
}) => {
  await verifiedMember(page)
  const id = await publishCapture(page, { title: `Comment ${crypto.randomUUID().slice(0, 8)}`, gameVersion: 'retail' })
  let dialogs = 0
  page.on('dialog', async (dialog) => {
    dialogs++
    await dialog.dismiss()
  })
  await page.goto(`/p/${id}`)
  await hydrated(page)
  const section = page.getByRole('region', { name: /^Comments · / })
  await expect(section.getByText('Be the first to comment')).toBeVisible()

  // Stored XSS (08 § 10): the payload is shown as text, never run, even after a reload rendered by the server
  const xss = '<img src=x onerror=alert(1)><svg onload=alert(2)> **bold** https://example.com'
  await section.getByLabel('Add a comment').fill(xss)
  await section.getByRole('button', { name: 'Post' }).click()
  // A new account: the server asks the Turnstile check (US-31.5, test key on previews), then the comment leaves
  await expect(section.getByText(xss)).toBeVisible({ timeout: 30_000 })
  await expect(section.getByRole('heading', { name: 'Comments · 1' })).toBeVisible()
  await page.reload()
  await hydrated(page)
  await expect(section.getByText(xss)).toBeVisible()
  await expect(section.locator('article img[src="x"], article svg[onload]')).toHaveCount(0)
  await expect(section.locator('article').getByRole('link', { name: 'https://example.com' })).toHaveCount(0)
  expect(dialogs).toBe(0)

  // Its author edits it (« edited »), then deletes it
  await section.getByRole('button', { name: 'Edit' }).click()
  await section.getByLabel('Edit your comment').fill('Lovely light')
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByText('Lovely light')).toBeVisible()
  await expect(section.getByText('edited')).toBeVisible()
  await section.getByRole('button', { name: 'Delete' }).click()
  await expect(section.getByText('Be the first to comment')).toBeVisible()
  await expect(section.getByRole('heading', { name: 'Comments · 0' })).toBeVisible()
})

test('US-32.1 US-32.3 US-72.1 without a native sheet, Share offers the link and the networks, tracked with consent', async ({
  page,
  context,
}) => {
  await verifiedMember(page)
  const id = await publishCapture(page, { title: `Share ${crypto.randomUUID().slice(0, 8)}`, gameVersion: 'retail' })
  // A desktop browser without navigator.share; PostHog answered here, nothing reaches it
  await page.addInitScript(() => Reflect.deleteProperty(Navigator.prototype, 'share'))
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const events: Record<string, unknown>[] = []
  await page.route('https://eu.i.posthog.com/**', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, body: '{}' })
  })
  await page.goto(`/p/${id}`)
  await hydrated(page)
  await page.getByRole('region', { name: 'Your cookie choices' }).getByRole('button', { name: 'Accept all' }).click()

  await page.getByRole('button', { name: 'Share' }).click()
  const url = `${new URL(page.url()).origin}/p/${id}`
  await expect(page.getByRole('link', { name: 'X', exact: true })).toHaveAttribute(
    'href',
    /^https:\/\/twitter\.com\/intent\/tweet\?url=/,
  )
  await expect(page.getByRole('link', { name: 'Reddit', exact: true })).toHaveAttribute(
    'href',
    /^https:\/\/www\.reddit\.com\/submit\?url=/,
  )
  await expect(page.getByRole('link', { name: 'Facebook', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url)
  await expect
    .poll(() => events.find((e) => e.event === 'photo_shared'))
    .toMatchObject({
      event: 'photo_shared',
      distinct_id: expect.any(String),
      properties: { method: 'copy' },
    })
  // Pseudonymous (US-72.1): no email nor username in what is sent
  expect(JSON.stringify(events)).not.toMatch(/@example\.com|e2e_/)
})

test('US-23.1 US-23.2 a visitor signs in to download the original, counted once a day', async ({ page }) => {
  const member = await verifiedMember(page)
  const id = await publishCapture(page, { title: `Download ${crypto.randomUUID().slice(0, 8)}`, gameVersion: 'retail' })
  expect((await post(page, '/api/auth/signout', {})).status).toBe(204)

  // A visitor is asked to sign in, then the download resumes on the page
  await page.goto(`/p/${id}`)
  await hydrated(page)
  await page.getByRole('button', { name: /^Download original · [\d.]+ MB$/ }).click()
  await page.waitForURL(/\/signin\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(`/p/${id}?download=1`)
  await hydrated(page)
  await page.getByLabel('Email').fill(member.email)
  await page.getByLabel('Password').fill(member.password)
  const saved = page.waitForEvent('download')
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
  const file = await saved
  expect(['jpg', 'webp', 'png'].map((ext) => `legendary-shots-${id}.${ext}`)).toContain(file.suggestedFilename())
  expect(await file.failure()).toBeNull()
  await expect(page).toHaveURL(`/p/${id}`) // the URL forgets the download: a reload does not start it again
  expect((await testRoute(page, `/__test/photos/${id}`, 'GET')).body.downloads).toBe(1)

  // The same member the same day: saved again, not counted again
  await hydrated(page)
  const again = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download original/ }).click()
  expect(await (await again).failure()).toBeNull()
  expect((await testRoute(page, `/__test/photos/${id}`, 'GET')).body.downloads).toBe(1)
})
