// Migrations and application role (T-05a). The database owner is only used for migrations; the Worker connects
// through Hyperdrive as ls_app, a plain login role member of app_rw (no UPDATE nor DELETE on audit_log, 0001).
//   node scripts/database.mjs migrate     applies the migrations to DATABASE_URL (CI, local)
//   node scripts/database.mjs production  production then template branch: migrations; Hyperdrive ls-prod on ls_app
//   node scripts/database.mjs template    creates the previews' template branch when missing (ADR-018)
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { cf, env, findBranch, hyperdriveOrigin, log, neon, ownerUrl } from './cloud.mjs'

const APP_ROLE = 'ls_app'
const MIGRATIONS = 'server/db/migrations'
const TEMPLATE = 'preview-template'

async function withSql(url, run) {
  const sql = postgres(String(url), { max: 1, onnotice: () => {} })
  try {
    return await run(sql)
  } finally {
    await sql.end()
  }
}

/** Applies the pending migrations (owner role). */
export async function migrate(url) {
  await withSql(url, (sql) => runMigrations(drizzle(sql), { migrationsFolder: MIGRATIONS }))
}

/** Empties every table except the site settings, whose author is erased: no personal data remains. */
export async function emptyData(url) {
  await withSql(url, async (sql) => {
    // users is emptied with DELETE: TRUNCATE … CASCADE would also empty site_settings, which references it
    await sql`update site_settings set updated_by = null`
    const tables =
      await sql`select tablename from pg_tables where schemaname = 'public' and tablename not in ('site_settings', 'users')`
    if (tables.length) await sql.unsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} cascade`)
    await sql`delete from users`
  })
}

/**
 * Template branch of previews and development (ADR-018): production schema, migration journal and roles,
 * without any data. Neon refuses schema-only branches once a role was created in SQL (app_rw, ls_app).
 */
export async function ensureTemplate() {
  const existing = await findBranch(TEMPLATE)
  if (existing) return existing
  const { branch } = await neon('POST', 'branches', {
    branch: { name: TEMPLATE, parent_id: (await findBranch('production')).id },
    endpoints: [{ type: 'read_write' }],
  })
  await emptyData(await ownerUrl(branch.id))
  log(`template branch ${TEMPLATE} created and emptied of its data`)
  return branch
}

/**
 * The Worker's login role, created in SQL with a new random password; returns its connection URL.
 * Never through the Neon API: a role created that way joins neon_superuser and inherits the owner's rights.
 */
export async function setAppRole(owner) {
  const password = randomBytes(24).toString('base64url') // [A-Za-z0-9_-]: safe inside an SQL string
  await withSql(owner, async (sql) => {
    const exists = (await sql`select 1 from pg_roles where rolname = ${APP_ROLE}`).length > 0
    // Attributes are set at creation; changing them later needs a superuser, so only the password changes
    const attributes = exists ? 'login' : 'login nosuperuser nocreatedb nocreaterole noreplication nobypassrls'
    await sql.unsafe(`${exists ? 'alter' : 'create'} role ${APP_ROLE} ${attributes} password '${password}'`)
    await sql.unsafe(`grant app_rw to ${APP_ROLE}`)
  })
  return Object.assign(new URL(owner), { username: APP_ROLE, password })
}

async function production() {
  const branch = await findBranch('production')
  const owner = await ownerUrl(branch.id)
  await migrate(owner)
  await migrate(await ownerUrl((await ensureTemplate()).id)) // the template follows the production schema
  log('migrations applied: production and template branch')
  // Only once: changing the password on every deployment would cut new connections for a moment
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === 'ls-prod')
  if (config.origin.user !== APP_ROLE) {
    const app = await setAppRole(owner)
    // Checked before switching: a code rollback would not restore the previous Hyperdrive configuration
    await withSql(app, (sql) => sql`select 1 from audit_log limit 1`)
    await cf('PUT', `hyperdrive/configs/${config.id}`, {
      name: config.name,
      origin: hyperdriveOrigin(app),
      caching: { disabled: true },
    })
    log(`Hyperdrive ls-prod switches to the ${APP_ROLE} role`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2]
  if (action === 'migrate') await migrate(env('DATABASE_URL'))
  else if (action === 'production') await production()
  else if (action === 'template') await ensureTemplate()
  else throw new Error('usage : node scripts/database.mjs migrate|production|template')
}
