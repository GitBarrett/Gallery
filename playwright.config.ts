import { defineConfig, devices } from '@playwright/test'

// Chromium: context.route also applies to service worker requests, so that they carry the Cloudflare Access service
// token of the previews (tests/e2e/fixtures.ts); otherwise the service worker would precache the Access login page
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'

// Projects of 11-strategie-de-tests.md: desktop, iPhone 14, Pixel 7. BASE_URL targets a preview in CI (T-04b).
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The 2-core runner would get 1 worker; the tests mostly wait for the remote preview. Not more than 2: E2E sign-ups
  // share 3 per hour from the CI address (counters emptied before each test, at most 2 sign-ups per test)
  workers: process.env.CI ? 2 : undefined,
  // In CI, HTML report attached to the run on failure (preview-deploy)
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        env: { NUXT_PUBLIC_SITE_URL: 'http://localhost:3000' },
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
