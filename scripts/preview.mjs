// node scripts/preview.mjs up <n> — crée ou met à jour la preview de la PR n (ADR-013, ADR-016, prototype T-00g).
// Idempotent : relancé à chaque commit de la PR, il réutilise la branche Neon, la configuration Hyperdrive et les files.
// Attend un build fait avec NITRO_PRESET=cloudflare_module et NUXT_DEPLOY_ENV=preview.
// Variables : CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { previewConfig } from './preview-config.mjs'

const [action, pr] = process.argv.slice(2)
if (action !== 'up' || !/^\d+$/.test(pr ?? '')) throw new Error('usage : node scripts/preview.mjs up <n>')
const env = (name) =>
  process.env[name] ||
  (() => {
    throw new Error(`variable manquante : ${name}`)
  })()
const BUCKET = 'ls-preview'
const NAME = `ls-pr-${pr}`
const BRANCH = `pr-${pr}`
const URL_ = `https://${NAME}.aleygues.workers.dev`
const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${msg}`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(base, token, method, path, body) {
  const res = await fetch(`${base}/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json.errors ?? json.message ?? json)}`)
  return json
}
const cf = (method, path, body) =>
  api(
    `https://api.cloudflare.com/client/v4/accounts/${env('CLOUDFLARE_ACCOUNT_ID')}`,
    env('CLOUDFLARE_API_TOKEN'),
    method,
    path,
    body,
  )
const neon = (method, path, body) =>
  api(`https://console.neon.tech/api/v2/projects/${env('NEON_PROJECT_ID')}`, env('NEON_API_KEY'), method, path, body)
const wrangler = (...args) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })

async function neonBranch() {
  let branch = (await neon('GET', 'branches')).branches.find((b) => b.name === BRANCH)
  if (!branch)
    branch = (await neon('POST', 'branches', { branch: { name: BRANCH }, endpoints: [{ type: 'read_write' }] })).branch
  const { uri } = await neon(
    'GET',
    `connection_uri?branch_id=${branch.id}&database_name=neondb&role_name=neondb_owner&pooled=false`,
  )
  log(`branche Neon ${BRANCH} prête`)
  return new URL(uri)
}

async function hyperdrive(uri) {
  const existing = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === NAME)
  if (existing) return existing.id
  const origin = {
    scheme: 'postgres',
    host: uri.hostname,
    port: 5432,
    database: uri.pathname.slice(1),
    user: decodeURIComponent(uri.username),
    password: decodeURIComponent(uri.password),
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return (await cf('POST', 'hyperdrive/configs', { name: NAME, origin, caching: { disabled: true } })).result.id
    } catch (error) {
      if (attempt >= 10) throw error
      await sleep(5000) // le point d'accès de la nouvelle branche démarre encore
    }
  }
}

async function ensureQueues(names) {
  const existing = new Set((await cf('GET', 'queues?per_page=100')).result.map((q) => q.queue_name))
  for (const name of names.filter((n) => !existing.has(n))) await cf('POST', 'queues', { queue_name: name })
  log(`${names.length} files prêtes`)
}

async function ensureBucket() {
  const buckets = (await cf('GET', 'r2/buckets')).result.buckets.map((b) => b.name)
  if (!buckets.includes(BUCKET)) await cf('POST', 'r2/buckets', { name: BUCKET })
  wrangler('r2', 'bucket', 'cors', 'set', BUCKET, '--file', 'infra/r2-cors.preview.json', '--force')
}

async function waitForHealth() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const res = await fetch(`${URL_}/api/health`).catch(() => null)
    if (res?.ok) return res.json()
    await sleep(3000) // propagation de workers.dev
  }
  throw new Error(`${URL_}/api/health ne répond pas`)
}

const uri = await neonBranch()
const hyperdriveId = await hyperdrive(uri)
log(`Hyperdrive ${NAME} prête (cache désactivé)`)
const { toml, queues } = previewConfig(readFileSync('wrangler.toml', 'utf8'), { pr, hyperdriveId })
await ensureQueues(queues)
await ensureBucket()
writeFileSync('wrangler.preview.toml', toml) // à la racine : main et assets sont relatifs au fichier de configuration
wrangler('deploy', '-c', 'wrangler.preview.toml')
log(`santé : ${JSON.stringify(await waitForHealth())}`)
log(`preview prête : ${URL_}`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${URL_}\n`)
