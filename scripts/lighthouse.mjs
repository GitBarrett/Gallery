// node scripts/lighthouse.mjs <url...> — mobile Lighthouse on the preview, US-68.2 thresholds (T-04b).
// Chromium is driven by Playwright: the Access service token is only added to requests for the preview,
// never to third parties (Web Analytics, Sentry); Lighthouse attaches through the debugging port.
// Variables: CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET (absent: no header, e.g. public site).
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import { failedThresholds, median } from './lighthouse-thresholds.mjs'

const urls = process.argv.slice(2)
if (!urls.length) throw new Error('usage : node scripts/lighthouse.mjs <url...>')
const RUNS = 3 // median of 3 runs: the performance score varies from one run to the next
const PORT = 9333

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lh-')), {
  args: [`--remote-debugging-port=${PORT}`],
})
const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env
if (id && secret)
  for (const origin of new Set(urls.map((u) => new URL(u).origin)))
    await context.route(`${origin}/**`, (route) =>
      route.continue({
        headers: { ...route.request().headers(), 'cf-access-client-id': id, 'cf-access-client-secret': secret },
      }),
    )

let failed = false
for (const url of urls) {
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    const { lhr } = await lighthouse(url, { port: PORT, output: 'json', logLevel: 'error' })
    if (lhr.runtimeError) throw new Error(`${url} : ${lhr.runtimeError.message}`)
    runs.push(Object.fromEntries(Object.entries(lhr.categories).map(([key, c]) => [key, c.score])))
  }
  const scores = median(runs)
  const failures = failedThresholds(scores)
  console.log(`${url} → ${JSON.stringify(scores)}${failures.length ? ` ✗ ${failures.join(', ')}` : ' ✓'}`)
  failed ||= failures.length > 0
}
await context.close()
if (failed) process.exit(1)
