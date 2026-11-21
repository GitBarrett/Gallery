// Cloudflare and Neon API calls shared by the operations scripts (preview.mjs, database.mjs).
// Variables : CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID.

export const env = (name) =>
  process.env[name] ||
  (() => {
    throw new Error(`missing variable: ${name}`)
  })()
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const t0 = Date.now()
export const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${msg}`)

async function api(base, token, method, path, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    // 423: Neon is still finishing an operation on the branch (creation, role…)
    if (res.status === 423 && attempt < 20) {
      await sleep(2000)
      continue
    }
    if (!res.ok)
      throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json.errors ?? json.message ?? json)}`)
    return json
  }
}

export const cf = (method, path, body) =>
  api(
    `https://api.cloudflare.com/client/v4/accounts/${env('CLOUDFLARE_ACCOUNT_ID')}`,
    env('CLOUDFLARE_API_TOKEN'),
    method,
    path,
    body,
  )
export const neon = (method, path, body) =>
  api(`https://console.neon.tech/api/v2/projects/${env('NEON_PROJECT_ID')}`, env('NEON_API_KEY'), method, path, body)

export const findBranch = async (name) => (await neon('GET', 'branches')).branches.find((b) => b.name === name)

/** Direct URL (no pooler) of the database owner: migrations only. */
export async function ownerUrl(branchId) {
  const { uri } = await neon(
    'GET',
    `connection_uri?branch_id=${branchId}&database_name=neondb&role_name=neondb_owner&pooled=false`,
  )
  return new URL(uri)
}

/** Hyperdrive origin from a Postgres URL. */
export const hyperdriveOrigin = (url) => ({
  scheme: 'postgres',
  host: url.hostname,
  port: 5432,
  database: url.pathname.slice(1),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
})
