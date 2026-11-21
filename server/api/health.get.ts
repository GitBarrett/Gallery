import postgres from 'postgres'
import type { Bindings } from '../platform/bindings'
import { databaseCheck, r2Check, runHealthChecks } from '../platform/health'

// Availability probe: database (Hyperdrive) and R2 when their bindings exist; 503 if one fails
export default defineEventHandler(async (event) => {
  const env: Bindings = event.context.cloudflare?.env ?? {}
  const sql = env.HYPERDRIVE && postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false })
  try {
    const health = await runHealthChecks({
      ...(sql && { database: databaseCheck(sql) }),
      ...(env.R2 && { r2: r2Check(env.R2, event.context.container.config.r2Prefix) }),
    })
    if (health.status === 'fail') setResponseStatus(event, 503)
    return health
  } finally {
    await sql?.end()
  }
})
