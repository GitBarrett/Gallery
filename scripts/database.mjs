// Migrations et rôle applicatif (T-05a). Le propriétaire de la base ne sert qu'aux migrations ; le Worker se connecte
// par Hyperdrive avec ls_app, membre du rôle app_rw (sans UPDATE ni DELETE sur audit_log, migration 0001).
//   node scripts/database.mjs migrate     applique les migrations sur DATABASE_URL (CI, local)
//   node scripts/database.mjs production  branche production : migrations, rôle ls_app, Hyperdrive ls-prod sur ls_app
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { cf, env, findBranch, hyperdriveOrigin, log, neon, ownerUrl } from './cloud.mjs'

const APP_ROLE = 'ls_app'
const MIGRATIONS = 'server/db/migrations'

async function withSql(url, run) {
  const sql = postgres(String(url), { max: 1, onnotice: () => {} })
  try {
    return await run(sql)
  } finally {
    await sql.end()
  }
}

/** Applique les migrations en attente (rôle propriétaire). */
export async function migrate(url) {
  await withSql(url, (sql) => runMigrations(drizzle(sql), { migrationsFolder: MIGRATIONS }))
}

/**
 * Une branche schema-only copie les tables mais pas le journal des migrations : sans lui, Drizzle rejouerait tout.
 * Recopie le journal de la source si la cible n'en a aucun ; les migrations suivantes s'appliquent alors seules.
 */
export async function copyJournal(fromUrl, toUrl) {
  const journal = 'drizzle.__drizzle_migrations'
  const rows = await withSql(fromUrl, async (sql) =>
    (await sql`select to_regclass(${journal}) as t`)[0].t
      ? sql`select hash, created_at from drizzle.__drizzle_migrations`
      : [],
  )
  if (!rows.length) return 0
  return withSql(toUrl, async (sql) => {
    if (!(await sql`select to_regclass(${journal}) as t`)[0].t) return 0
    if ((await sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0].n) return 0
    await sql`insert into drizzle.__drizzle_migrations ${sql(rows, 'hash', 'created_at')}`
    return rows.length
  })
}

/** Rôle de connexion du Worker (géré par Neon), membre de app_rw ; renvoie son URL de connexion. */
export async function appUrl(branchId, owner) {
  const { roles } = await neon('GET', `branches/${branchId}/roles`)
  if (!roles.some((r) => r.name === APP_ROLE))
    await neon('POST', `branches/${branchId}/roles`, { role: { name: APP_ROLE } })
  const { password } = await neon('GET', `branches/${branchId}/roles/${APP_ROLE}/reveal_password`)
  await withSql(owner, (sql) => sql`grant app_rw to ${sql(APP_ROLE)}`)
  const url = new URL(owner)
  url.username = APP_ROLE
  url.password = password
  return url
}

async function production() {
  const branch = await findBranch('production')
  const owner = await ownerUrl(branch.id)
  await migrate(owner)
  log('migrations de production appliquées')
  const app = await appUrl(branch.id, owner)
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === 'ls-prod')
  if (config.origin.user !== APP_ROLE) {
    await cf('PUT', `hyperdrive/configs/${config.id}`, {
      name: config.name,
      origin: hyperdriveOrigin(app),
      caching: { disabled: true },
    })
    log(`Hyperdrive ls-prod passe sur le rôle ${APP_ROLE}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2]
  if (action === 'migrate') await migrate(env('DATABASE_URL'))
  else if (action === 'production') await production()
  else throw new Error('usage : node scripts/database.mjs migrate|production')
}
