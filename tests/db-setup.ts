import { migrate } from '../scripts/database.mjs'

// globalSetup du projet integration : la base de test (DATABASE_URL) est migrée une fois avant les tests
export default async function setup() {
  if (process.env.DATABASE_URL) await migrate(process.env.DATABASE_URL)
}
