import { migrate } from '../scripts/database.mjs'

// globalSetup of the integration project: the test database (DATABASE_URL) is migrated once before the tests
export default async function setup() {
  if (process.env.DATABASE_URL) await migrate(process.env.DATABASE_URL)
}
