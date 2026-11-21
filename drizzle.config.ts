import { defineConfig } from 'drizzle-kit'

// Migrations générées depuis le schéma (pnpm db:generate), appliquées par scripts/database.mjs (pnpm db:migrate)
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
})
