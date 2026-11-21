import { defineConfig } from 'drizzle-kit'

// Migrations generated from the schema (pnpm db:generate), applied by scripts/database.mjs (pnpm db:migrate)
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
})
