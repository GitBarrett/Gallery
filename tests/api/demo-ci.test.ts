import postgres from 'postgres'
import { expect, it } from 'vitest'

// DÉMO T-04a : le Postgres de CI répond, puis une assertion d'intégration échoue
it('reaches the CI Postgres, then fails on purpose', async () => {
  const sql = postgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/postgres')
  const [{ one }] = await sql`select 1 as one`
  await sql.end()
  expect(one).toBe(1)
  expect('integration').toBe('broken')
})
