// Migrations et rôle applicatif (T-05a). Le propriétaire de la base ne sert qu'aux migrations ; le Worker se connecte
// par Hyperdrive avec ls_app, simple rôle de connexion membre de app_rw (sans UPDATE ni DELETE sur audit_log, 0001).
//   node scripts/database.mjs migrate     applique les migrations sur DATABASE_URL (CI, local)
//   node scripts/database.mjs production  production puis branche modèle : migrations ; Hyperdrive ls-prod sur ls_app
//   node scripts/database.mjs template    crée la branche modèle des previews si elle manque (ADR-018)
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

/** Applique les migrations en attente (rôle propriétaire). */
export async function migrate(url) {
  await withSql(url, (sql) => runMigrations(drizzle(sql), { migrationsFolder: MIGRATIONS }))
}

/** Vide toutes les tables sauf les réglages du site, dont l'auteur est effacé : aucune donnée personnelle ne reste. */
export async function emptyData(url) {
  await withSql(url, async (sql) => {
    const tables =
      await sql`select tablename from pg_tables where schemaname = 'public' and tablename <> 'site_settings'`
    if (tables.length) await sql.unsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} cascade`)
    await sql`update site_settings set updated_by = null`
  })
}

/**
 * Branche modèle des previews et du développement (ADR-018) : schéma, journal des migrations et rôles de production,
 * sans aucune donnée. Neon refuse les branches schema-only dès qu'un rôle a été créé en SQL (app_rw, ls_app).
 */
export async function ensureTemplate() {
  const existing = await findBranch(TEMPLATE)
  if (existing) return existing
  const { branch } = await neon('POST', 'branches', {
    branch: { name: TEMPLATE, parent_id: (await findBranch('production')).id },
    endpoints: [{ type: 'read_write' }],
  })
  await emptyData(await ownerUrl(branch.id))
  log(`branche modèle ${TEMPLATE} créée et vidée de ses données`)
  return branch
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
  await migrate(await ownerUrl((await ensureTemplate()).id)) // le modèle suit le schéma de production
  log('migrations appliquées : production et branche modèle')
  // Une seule fois : changer le mot de passe à chaque déploiement couperait les nouvelles connexions un instant
  const config = (await cf('GET', 'hyperdrive/configs')).result.find((c) => c.name === 'ls-prod')
  if (config.origin.user !== APP_ROLE) {
    const app = await setAppRole(owner)
    // Vérifiée avant de basculer : le retour arrière du code ne rétablirait pas l'ancienne configuration Hyperdrive
    await withSql(app, (sql) => sql`select 1 from audit_log limit 1`)
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
  else if (action === 'template') await ensureTemplate()
  else throw new Error('usage : node scripts/database.mjs migrate|production|template')
}
