// Previews per pull request (ADR-013, ADR-016, T-00g prototype):
//   up <n>        creates or updates the preview of pull request n (T-03b). Idempotent: run on every commit, it reuses
//                 the Neon branch and the queues, applies the migrations (T-05a) and rewrites the Hyperdrive
//                 configuration. Expects a build made with NITRO_PRESET=cloudflare_module and NUXT_DEPLOY_ENV=preview.
//   down <n>      deletes every resource of pull request n and checks through the APIs that none is left (T-03c).
//   sweep [n...]  deletes orphan previews: any pull request owning a resource without being in the open list.
// Variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID; for up, CF_ACCESS_CLIENT_ID
// and CF_ACCESS_CLIENT_SECRET (the CI's Access service token, T-03d).
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cf, env, findBranch, hyperdriveOrigin, log, neon, ownerUrl, sleep } from './cloud.mjs'
import { previewConfig, previewNumbers } from './preview-config.mjs'

const [action, ...prs] = process.argv.slice(2)
const pr = prs[0]
if (
  !prs.every((n) => /^\d+$/.test(n)) ||
  !(action === 'sweep' || (['up', 'down'].includes(action) && prs.length === 1))
)
  throw new Error('usage : node scripts/preview.mjs up|down <n> | sweep [PR ouvertes...]')
const BUCKET = 'ls-preview'
const NAME = `ls-pr-${pr}`
const BRANCH = `pr-${pr}`
const URL_ = `https://${NAME}.aleygues.workers.dev`
const wrangler = (...args) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })

async function listQueues() {
  const queues = []
  for (let page = 1; ; page++) {
    const { result } = await cf('GET', `queues?per_page=100&page=${page}`)
    queues.push(...result)
    if (result.length < 100) return queues
  }
}

async function r2Keys(prefix) {
  const keys = []
  for (let cursor = ''; ;) {
    const page = await cf('GET', `r2/buckets/${BUCKET}/objects?prefix=${prefix}&per_page=1000${cursor}`)
    keys.push(...page.result.map((o) => o.key))
    if (!page.result_info?.is_truncated) return keys
    cursor = `&cursor=${encodeURIComponent(page.result_info.cursor)}`
  }
}

async function neonBranch() {
  let branch = await findBranch(BRANCH)
  if (!branch) {
    // Child of the template branch, without data: never any production data in a preview (ADR-018)
    const template = await findBranch('preview-template')
    if (!template) throw new Error('preview-template branch missing: node scripts/database.mjs template (ADR-018)')
    branch = (
      await neon('POST', 'branches', {
        branch: { name: BRANCH, parent_id: template.id },
        endpoints: [{ type: 'read_write' }],
      })
    ).branch
  }
  log(`Neon branch ${BRANCH} ready`)
  return branch
}

// Dynamic import: database.mjs depends on drizzle and postgres, missing from the deletion job (no install)
async function migrateBranch(branch) {
  const { migrate, setAppRole } = await import('./database.mjs')
  const owner = await ownerUrl(branch.id)
  await migrate(owner) // only the pull request migrations: the template already has the production ones
  log('migrations applied')
  return setAppRole(owner) // new password on every run, set in Hyperdrive right away
}

async function hyperdrive(url) {
  const existing = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === NAME)
  // Always rewritten: a recreated branch changes host and password
  const [method, path] = existing ? ['PUT', `hyperdrive/configs/${existing.id}`] : ['POST', 'hyperdrive/configs']
  const origin = hyperdriveOrigin(url)
  for (let attempt = 1; ; attempt++) {
    try {
      return (await cf(method, path, { name: NAME, origin, caching: { disabled: true } })).result.id
    } catch (error) {
      if (attempt >= 10) throw error
      await sleep(5000) // the new branch's endpoint is still starting
    }
  }
}

async function ensureQueues(names) {
  const existing = new Set((await listQueues()).map((q) => q.queue_name))
  for (const name of names.filter((n) => !existing.has(n))) await cf('POST', 'queues', { queue_name: name })
  log(`${names.length} queues ready`)
}

async function ensureBucket() {
  const buckets = (await cf('GET', 'r2/buckets')).result.buckets.map((b) => b.name)
  if (!buckets.includes(BUCKET)) await cf('POST', 'r2/buckets', { name: BUCKET })
  wrangler('r2', 'bucket', 'cors', 'set', BUCKET, '--file', 'infra/r2-cors.preview.json', '--force')
}

async function waitForHealth() {
  // Previews behind Cloudflare Access (T-03d): service token; without it, Access redirects to its login page
  const headers = {
    'cf-access-client-id': env('CF_ACCESS_CLIENT_ID'),
    'cf-access-client-secret': env('CF_ACCESS_CLIENT_SECRET'),
  }
  for (let attempt = 1; attempt <= 30; attempt++) {
    const res = await fetch(`${URL_}/api/health`, { headers, redirect: 'manual' }).catch(() => null)
    if (res?.ok) return res.json()
    await sleep(3000) // workers.dev propagation
  }
  throw new Error(`${URL_}/api/health does not respond`)
}

async function up() {
  const app = await migrateBranch(await neonBranch())
  const hyperdriveId = await hyperdrive(app)
  log(`Hyperdrive ${NAME} ready (ls_app role, cache disabled)`)
  const { toml, queues } = previewConfig(readFileSync('wrangler.toml', 'utf8'), { pr, hyperdriveId })
  await ensureQueues(queues)
  await ensureBucket()
  writeFileSync('wrangler.preview.toml', toml) // at the root: main and assets are relative to the configuration file
  // Seal of the session cookie (NUXT_APP_SECRET): random at each deploy, the sessions of a preview are throwaway
  const secrets = join(tmpdir(), `${NAME}-secrets.json`)
  writeFileSync(secrets, JSON.stringify({ NUXT_APP_SECRET: randomBytes(32).toString('base64') }))
  try {
    wrangler('deploy', '-c', 'wrangler.preview.toml', '--secrets-file', secrets)
  } finally {
    rmSync(secrets)
  }
  log(`health: ${JSON.stringify(await waitForHealth())}`)
  log(`preview ready: ${URL_}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${URL_}\n`)
}

// Names of every account resource that may belong to a preview; previewNumbers derives the pull requests.
async function inventory() {
  const [workers, queues, configs, { branches }, keys] = await Promise.all([
    cf('GET', 'workers/scripts'),
    listQueues(),
    cf('GET', 'hyperdrive/configs'),
    neon('GET', 'branches'),
    r2Keys(''), // shortcut: lists the whole ls-preview bucket (demo seed per PR), switch to delimiter=/ if it grows
  ])
  return [
    ...workers.result.map((w) => w.id),
    ...queues.map((q) => q.queue_name),
    ...configs.result.map((c) => c.name),
    ...branches.map((b) => b.name),
    ...keys.map((key) => `${key.split('/')[0]}/`),
  ]
}

async function down(n) {
  const name = `ls-pr-${n}`
  const queues = (await listQueues()).filter((q) => q.queue_name.endsWith(`-pr-${n}`))
  if ((await cf('GET', 'workers/scripts')).result.some((w) => w.id === name)) {
    // Cloudflare refuses to delete a Worker that still consumes a queue (T-00g)
    for (const q of queues)
      for (const c of (await cf('GET', `queues/${q.queue_id}/consumers`)).result)
        await cf('DELETE', `queues/${q.queue_id}/consumers/${c.consumer_id}`)
    await cf('DELETE', `workers/scripts/${name}?force=true`)
    log(`Worker ${name} deleted`)
  }
  for (const q of queues) await cf('DELETE', `queues/${q.queue_id}`)
  log(`${queues.length} queues deleted`)
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === name)
  if (config) await cf('DELETE', `hyperdrive/configs/${config.id}`)
  const branch = (await neon('GET', 'branches')).branches.find((b) => b.name === `pr-${n}`)
  if (branch) await neon('DELETE', `branches/${branch.id}`)
  const keys = await r2Keys(`pr-${n}/`)
  for (const key of keys)
    await cf('DELETE', `r2/buckets/${BUCKET}/objects/${key.split('/').map(encodeURIComponent).join('/')}`)
  log(`Hyperdrive, Neon branch and ${keys.length} R2 objects deleted`)
  if (previewNumbers(await inventory()).has(n)) throw new Error(`resources of preview ${n} are left`)
  log(`preview ${n} deleted, checked through the APIs`)
}

async function sweep(open) {
  const orphans = [...previewNumbers(await inventory())].filter((n) => !open.includes(n))
  log(`orphan previews: ${orphans.join(', ') || 'none'}`)
  for (const n of orphans) await down(n)
}

await (action === 'up' ? up() : action === 'down' ? down(pr) : sweep(prs))
