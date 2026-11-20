// Prototype jetable T-00e : latence Worker -> Neon (Hyperdrive avec et sans cache, connexion directe)
// et délai avant qu'une session révoquée soit vue par une lecture via Hyperdrive avec cache (ADR-010).
// Date.now() avance sur les entrées-sorties : la mesure des requêtes dans le Worker est valable.
import postgres from 'postgres'

interface Env {
  HD_CACHED: Hyperdrive
  HD_NOCACHE: Hyperdrive
  DATABASE_URL: string // pooler Neon, comme les previews (ADR-013)
  PROTO_TOKEN: string
}

const connect = (url: string) => postgres(url, { max: 1, fetch_types: false })

function urlFor(env: Env, via: string | null) {
  if (via === 'cached') return env.HD_CACHED.connectionString
  if (via === 'nocache') return env.HD_NOCACHE.connectionString
  if (via === 'direct') return env.DATABASE_URL
  return null
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function latency(url: string, n: number) {
  const sql = connect(url)
  try {
    let t = Date.now()
    await sql`select 1`
    const first = Date.now() - t
    const times: number[] = []
    for (let i = 0; i < n; i++) {
      t = Date.now()
      await sql`select 1`
      times.push(Date.now() - t)
    }
    return { firstMs: first, medianMs: median(times), maxMs: Math.max(...times), n }
  } finally {
    await sql.end()
  }
}

async function sessionTest(env: Env) {
  const cached = connect(env.HD_CACHED.connectionString)
  const nocache = connect(env.HD_NOCACHE.connectionString)
  try {
    await nocache`create table if not exists t00e_sessions (id text primary key, revoked_at timestamptz)`
    const id = crypto.randomUUID()
    await nocache`insert into t00e_sessions (id) values (${id})`
    const read = (sql: postgres.Sql) => sql`select revoked_at from t00e_sessions where id = ${id}`.then((r) => r[0].revoked_at)
    await read(cached) // amorce le cache
    await nocache`update t00e_sessions set revoked_at = now() where id = ${id}`
    const t0 = Date.now()
    const uncachedSeesIt = (await read(nocache)) !== null
    let cachedDelayMs: number | null = null
    while (Date.now() - t0 < 90_000) {
      if ((await read(cached)) !== null) {
        cachedDelayMs = Date.now() - t0
        break
      }
      await sleep(2000)
    }
    await nocache`delete from t00e_sessions where id = ${id}`
    return { uncachedSeesRevocationImmediately: uncachedSeesIt, cachedSeesRevocationAfterMs: cachedDelayMs }
  } finally {
    await Promise.all([cached.end(), nocache.end()])
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.PROTO_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PROTO_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const url = new URL(request.url)
    const colo = (request as { cf?: { colo?: string } }).cf?.colo
    try {
      if (url.pathname === '/latency') {
        const target = urlFor(env, url.searchParams.get('via'))
        if (!target) return new Response('via=cached|nocache|direct', { status: 400 })
        const n = Math.min(Number(url.searchParams.get('n') ?? 20), 50)
        return Response.json({ colo, via: url.searchParams.get('via'), ...(await latency(target, n)) })
      }
      if (url.pathname === '/session-test') return Response.json({ colo, ...(await sessionTest(env)) })
    } catch (e) {
      return new Response(String(e), { status: 500 })
    }
    return new Response('Not found', { status: 404 })
  },
}
