import postgres from 'postgres'
import type { Bindings } from '../platform/bindings'
import { databaseCheck, r2Check, runHealthChecks } from '../platform/health'

// Sonde de disponibilité : base (Hyperdrive) et R2 quand leurs bindings existent ; 503 si l'un échoue
export default defineEventHandler(async (event) => {
  const env: Bindings = event.context.cloudflare?.env ?? {}
  const sql = env.HYPERDRIVE && postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false })
  try {
    const health = await runHealthChecks({
      ...(sql && { database: databaseCheck(sql) }),
      ...(env.R2 && { r2: r2Check(env.R2) }),
    })
    if (health.status === 'fail') setResponseStatus(event, 503)
    return health
  } finally {
    await sql?.end()
  }
})
