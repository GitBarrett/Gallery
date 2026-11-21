// Previews par PR (ADR-013, ADR-016, prototype T-00g) :
//   up <n>        crée ou met à jour la preview de la PR n (T-03b). Idempotent : relancé à chaque commit, il réutilise
//                 la branche Neon et les files, applique les migrations (T-05a) et réécrit la configuration
//                 Hyperdrive. Attend un build fait avec NITRO_PRESET=cloudflare_module et NUXT_DEPLOY_ENV=preview.
//   down <n>      supprime toutes les ressources de la PR n et vérifie par l'API qu'il n'en reste aucune (T-03c).
//   sweep [n...]  supprime les previews orphelines : toute PR qui a une ressource sans être dans la liste des ouvertes.
// Variables : CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID ; pour up, CF_ACCESS_CLIENT_ID
// et CF_ACCESS_CLIENT_SECRET (jeton de service Access de la CI, T-03d).
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
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
    // Enfant de la branche modèle, sans données : jamais de données de production dans une preview (ADR-018)
    const template = await findBranch('preview-template')
    if (!template) throw new Error('branche preview-template absente : node scripts/database.mjs template (ADR-018)')
    branch = (
      await neon('POST', 'branches', {
        branch: { name: BRANCH, parent_id: template.id },
        endpoints: [{ type: 'read_write' }],
      })
    ).branch
  }
  log(`branche Neon ${BRANCH} prête`)
  return branch
}

// Import dynamique : database.mjs dépend de drizzle et de postgres, absents du job de suppression (sans installation)
async function migrateBranch(branch) {
  const { migrate, setAppRole } = await import('./database.mjs')
  const owner = await ownerUrl(branch.id)
  await migrate(owner) // seulement les migrations de la PR : le modèle a déjà celles de production
  log('migrations appliquées')
  return setAppRole(owner) // nouveau mot de passe à chaque passage, aussitôt posé dans Hyperdrive
}

async function hyperdrive(url) {
  const existing = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === NAME)
  // Toujours réécrite : une branche recréée change d'hôte et de mot de passe
  const [method, path] = existing ? ['PUT', `hyperdrive/configs/${existing.id}`] : ['POST', 'hyperdrive/configs']
  const origin = hyperdriveOrigin(url)
  for (let attempt = 1; ; attempt++) {
    try {
      return (await cf(method, path, { name: NAME, origin, caching: { disabled: true } })).result.id
    } catch (error) {
      if (attempt >= 10) throw error
      await sleep(5000) // le point d'accès de la nouvelle branche démarre encore
    }
  }
}

async function ensureQueues(names) {
  const existing = new Set((await listQueues()).map((q) => q.queue_name))
  for (const name of names.filter((n) => !existing.has(n))) await cf('POST', 'queues', { queue_name: name })
  log(`${names.length} files prêtes`)
}

async function ensureBucket() {
  const buckets = (await cf('GET', 'r2/buckets')).result.buckets.map((b) => b.name)
  if (!buckets.includes(BUCKET)) await cf('POST', 'r2/buckets', { name: BUCKET })
  wrangler('r2', 'bucket', 'cors', 'set', BUCKET, '--file', 'infra/r2-cors.preview.json', '--force')
}

async function waitForHealth() {
  // Previews derrière Cloudflare Access (T-03d) : jeton de service ; sans lui, Access redirige vers sa page de connexion
  const headers = {
    'cf-access-client-id': env('CF_ACCESS_CLIENT_ID'),
    'cf-access-client-secret': env('CF_ACCESS_CLIENT_SECRET'),
  }
  for (let attempt = 1; attempt <= 30; attempt++) {
    const res = await fetch(`${URL_}/api/health`, { headers, redirect: 'manual' }).catch(() => null)
    if (res?.ok) return res.json()
    await sleep(3000) // propagation de workers.dev
  }
  throw new Error(`${URL_}/api/health ne répond pas`)
}

async function up() {
  const app = await migrateBranch(await neonBranch())
  const hyperdriveId = await hyperdrive(app)
  log(`Hyperdrive ${NAME} prête (rôle ls_app, cache désactivé)`)
  const { toml, queues } = previewConfig(readFileSync('wrangler.toml', 'utf8'), { pr, hyperdriveId })
  await ensureQueues(queues)
  await ensureBucket()
  writeFileSync('wrangler.preview.toml', toml) // à la racine : main et assets sont relatifs au fichier de configuration
  wrangler('deploy', '-c', 'wrangler.preview.toml')
  log(`santé : ${JSON.stringify(await waitForHealth())}`)
  log(`preview prête : ${URL_}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${URL_}\n`)
}

// Noms de toutes les ressources du compte qui peuvent appartenir à une preview ; previewNumbers en tire les PR.
async function inventory() {
  const [workers, queues, configs, { branches }, keys] = await Promise.all([
    cf('GET', 'workers/scripts'),
    listQueues(),
    cf('GET', 'hyperdrive/configs'),
    neon('GET', 'branches'),
    r2Keys(''), // shortcut: liste tout ls-preview (seed de démo par PR), passer à delimiter=/ s'il grossit
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
    // Cloudflare refuse de supprimer un Worker encore consommateur d'une file (T-00g)
    for (const q of queues)
      for (const c of (await cf('GET', `queues/${q.queue_id}/consumers`)).result)
        await cf('DELETE', `queues/${q.queue_id}/consumers/${c.consumer_id}`)
    await cf('DELETE', `workers/scripts/${name}?force=true`)
    log(`Worker ${name} supprimé`)
  }
  for (const q of queues) await cf('DELETE', `queues/${q.queue_id}`)
  log(`${queues.length} files supprimées`)
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === name)
  if (config) await cf('DELETE', `hyperdrive/configs/${config.id}`)
  const branch = (await neon('GET', 'branches')).branches.find((b) => b.name === `pr-${n}`)
  if (branch) await neon('DELETE', `branches/${branch.id}`)
  const keys = await r2Keys(`pr-${n}/`)
  for (const key of keys)
    await cf('DELETE', `r2/buckets/${BUCKET}/objects/${key.split('/').map(encodeURIComponent).join('/')}`)
  log(`Hyperdrive, branche Neon et ${keys.length} objets R2 supprimés`)
  if (previewNumbers(await inventory()).has(n)) throw new Error(`il reste des ressources de la preview ${n}`)
  log(`preview ${n} supprimée, vérifié par l'API`)
}

async function sweep(open) {
  const orphans = [...previewNumbers(await inventory())].filter((n) => !open.includes(n))
  log(`previews orphelines : ${orphans.join(', ') || 'aucune'}`)
  for (const n of orphans) await down(n)
}

await (action === 'up' ? up() : action === 'down' ? down(pr) : sweep(prs))
