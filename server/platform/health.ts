import type { HealthResponse } from '../../shared/contracts/health'

type Check = () => Promise<unknown>

/** Lance tous les contrôles, même si l'un échoue, pour que la sonde voie chaque dépendance (03-architecture.md § Observabilité). */
export async function runHealthChecks(checks: Record<string, Check>): Promise<HealthResponse> {
  const names = Object.keys(checks)
  const results = await Promise.allSettled(names.map((name) => checks[name]!()))
  const status = Object.fromEntries(
    names.map((name, i) => [name, results[i]!.status === 'fulfilled' ? 'ok' : 'fail'] as const),
  )
  return { status: Object.values(status).every((s) => s === 'ok') ? 'ok' : 'fail', checks: status }
}

export const databaseCheck =
  (sql: (strings: TemplateStringsArray) => Promise<unknown>): Check =>
  () =>
    sql`select 1`

export const r2Check =
  (bucket: { head(key: string): Promise<unknown> }): Check =>
  () =>
    bucket.head('health')
