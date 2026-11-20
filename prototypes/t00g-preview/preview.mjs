// Prototype jetable T-00g (ADR-013, ADR-016) : node preview.mjs up|down <n>
// up   : branche Neon pr-n, configuration Hyperdrive, Queue, préfixe R2, Worker ls-pr-n, puis tests de fumée.
// down : supprime tout et vérifie qu'il ne reste rien. Durées affichées (critère : création < 5 min).
// Les secrets sont lus dans les .env des autres prototypes et ne sont jamais affichés.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [action, n] = process.argv.slice(2)
if (!['up', 'down'].includes(action) || !/^\d+$/.test(n ?? '')) throw new Error('usage: node preview.mjs up|down <n>')

const envOf = (file, key) => readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))[1].trim()
const CF_TOKEN = envOf('../t00ab-images/.env', 'CLOUDFLARE_API_TOKEN')
const PROTO_TOKEN = envOf('../t00ab-images/.env', 'PROTO_TOKEN')
const NEON_KEY = envOf('../t00e-neon/.env', 'NEON_API_KEY')
const ACCOUNT = '06191bf5d43b947b6dbd99831b716629'
const PROJECT = 'calm-mode-49605156'
const NAME = `ls-pr-${n}`
const QUEUE = `ls-pr-${n}-jobs`
const BRANCH = `pr-${n}`
const PREFIX = `pr-${n}/`
const BUCKET = 'ls-preview'
const URL_ = `https://${NAME}.aleygues.workers.dev`

const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(base, token, method, path, body) {
  const res = await fetch(`${base}/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.errors ?? json.message ?? json)}`)
  return json
}
const cf = (method, path, body) => api(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`, CF_TOKEN, method, path, body)
const neon = (method, path, body) => api(`https://console.neon.tech/api/v2/projects/${PROJECT}`, NEON_KEY, method, path, body)
const wrangler = (...args) =>
  execFileSync('npx', ['--yes', 'wrangler@4', ...args], { env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN }, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'] })

const findBranch = async () => (await neon('GET', 'branches')).branches.find((b) => b.name === BRANCH)
const findHyperdrive = async () => (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === NAME)
const findQueue = async () => (await cf('GET', 'queues')).result.find((q) => q.queue_name === QUEUE)
const findWorker = async () => (await cf('GET', 'workers/scripts')).result.find((s) => s.id === NAME)
const call = (path) => fetch(`${URL_}${path}`, { headers: { authorization: `Bearer ${PROTO_TOKEN}` } })

async function up() {
  const created = await neon('POST', 'branches', { branch: { name: BRANCH }, endpoints: [{ type: 'read_write' }] })
  const uri = new URL(created.connection_uris[0].connection_uri)
  log(`branche Neon ${BRANCH} créée`)

  let hd
  for (let i = 0; !hd; i++) {
    try {
      hd = (await cf('POST', 'hyperdrive/configs', {
        name: NAME,
        origin: { scheme: 'postgres', host: uri.hostname, port: 5432, database: uri.pathname.slice(1), user: decodeURIComponent(uri.username), password: decodeURIComponent(uri.password) },
        caching: { disabled: true },
      })).result
    } catch (e) {
      if (i >= 10) throw e
      await sleep(5000) // le point d'accès de la branche démarre encore
    }
  }
  log(`Hyperdrive ${NAME} créée (cache désactivé)`)

  await cf('POST', 'queues', { queue_name: QUEUE })
  log(`Queue ${QUEUE} créée`)
  try {
    await cf('POST', 'r2/buckets', { name: BUCKET })
  } catch {} // le bucket des previews est partagé ; il existe déjà après la première preview

  const dir = mkdtempSync(join(tmpdir(), 'ls-preview-'))
  const toml = join(dir, 'wrangler.toml')
  writeFileSync(toml, `name = "${NAME}"
main = "${resolve('src/index.ts').replaceAll('\\', '/')}"
compatibility_date = "2026-11-01"
compatibility_flags = ["nodejs_compat"]
vars = { R2_PREFIX = "${PREFIX}" }

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "${hd.id}"

[[r2_buckets]]
binding = "R2"
bucket_name = "${BUCKET}"

[[queues.producers]]
binding = "QUEUE"
queue = "${QUEUE}"

[[queues.consumers]]
queue = "${QUEUE}"
max_batch_timeout = 1
`)
  // Code et secrets dans une seule version : un `secret put` après le déploiement laisse quelques secondes
  // pendant lesquelles des requêtes tombent sur la version sans secret (constaté sur la PR 901).
  const secrets = join(dir, 'secrets.json')
  writeFileSync(secrets, JSON.stringify({ PROTO_TOKEN }))
  try {
    wrangler('deploy', '-c', toml, '--secrets-file', secrets)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  log(`Worker ${NAME} déployé avec ses secrets`)

  let health
  for (let i = 0; i < 20 && !health; i++) {
    const res = await call('/health')
    if (res.ok) health = await res.json()
    else await sleep(3000) // propagation de workers.dev
  }
  log(`/health : ${JSON.stringify(health)}`)
  const { sent } = await (await call('/queue')).json()
  for (let i = 0; i < 30; i++) {
    const done = await (await call('/queue-done')).json()
    if (done.some((k) => k.endsWith(sent))) {
      log('message de Queue traité')
      break
    }
    await sleep(2000)
  }
  log(`preview ${NAME} prête`)
}

async function down() {
  const q = await findQueue()
  if (await findWorker()) {
    const res = await call('/cleanup')
    log(`R2 ${PREFIX} vidé : ${res.ok ? JSON.stringify(await res.json()) : res.status}`)
    // Cloudflare refuse de supprimer un Worker encore consommateur d'une Queue
    for (const c of q ? (await cf('GET', `queues/${q.queue_id}/consumers`)).result : []) {
      await cf('DELETE', `queues/${q.queue_id}/consumers/${c.consumer_id}`)
    }
    await cf('DELETE', `workers/scripts/${NAME}?force=true`)
    log(`Worker ${NAME} supprimé`)
  }
  if (q) await cf('DELETE', `queues/${q.queue_id}`), log(`Queue ${QUEUE} supprimée`)
  const hd = await findHyperdrive()
  if (hd) await cf('DELETE', `hyperdrive/configs/${hd.id}`), log(`Hyperdrive ${NAME} supprimée`)
  const b = await findBranch()
  if (b) await neon('DELETE', `branches/${b.id}`), log(`branche Neon ${BRANCH} supprimée`)

  const r2Left = await cf('GET', `r2/buckets/${BUCKET}/objects?prefix=${encodeURIComponent(PREFIX)}`).then((j) => j.result.length, (e) => `inconnu (${e.message.slice(0, 60)})`)
  const left = { worker: !!(await findWorker()), queue: !!(await findQueue()), hyperdrive: !!(await findHyperdrive()), branch: !!(await findBranch()), r2Objects: r2Left }
  log(`restes : ${JSON.stringify(left)}`)
}

await (action === 'up' ? up() : down())
