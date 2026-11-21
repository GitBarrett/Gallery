// Migrations et rôle applicatif (T-05a). Le propriétaire de la base ne sert qu'aux migrations ; le Worker se connecte
// par Hyperdrive avec ls_app, simple rôle de connexion membre de app_rw (sans UPDATE ni DELETE sur audit_log, 0001).
//   node scripts/database.mjs migrate     applique les migrations sur DATABASE_URL (CI, local)
//   node scripts/database.mjs production  branche production : migrations, rôle ls_app, Hyperdrive ls-prod sur ls_app
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { cf, env, findBranch, hyperdriveOrigin, log, ownerUrl } from './cloud.mjs'

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

/**
 * Rôle de connexion du Worker, créé en SQL avec un nouveau mot de passe aléatoire ; renvoie son URL de connexion.
 * Jamais par l'API Neon : un rôle créé ainsi est membre de neon_superuser et hérite des droits du propriétaire.
 */
export async function setAppRole(owner) {
  const password = randomBytes(24).toString('base64url') // [A-Za-z0-9_-] : sûr dans une chaîne SQL
  await withSql(owner, async (sql) => {
    const exists = (await sql`select 1 from pg_roles where rolname = ${APP_ROLE}`).length > 0
    // Attributs posés à la création ; les modifier ensuite exige un superutilisateur, seul le mot de passe change
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
  log('migrations de production appliquées')
  // Une seule fois : changer le mot de passe à chaque déploiement couperait les nouvelles connexions un instant
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === 'ls-prod')
  if (config.origin.user !== APP_ROLE) {
    await cf('PUT', `hyperdrive/configs/${config.id}`, {
      name: config.name,
      origin: hyperdriveOrigin(await setAppRole(owner)),
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
