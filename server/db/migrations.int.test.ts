import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { emptyData, migrate, setAppRole } from '../../scripts/database.mjs'

// Blank database created for this file (11-strategie-de-tests.md § 7): migrations apply from scratch.
const base = process.env.DATABASE_URL
if (!base) throw new Error('DATABASE_URL missing: Postgres service in CI, .env.test locally')
const name = `migrations_${Date.now()}`
const url = Object.assign(new URL(base), { pathname: `/${name}` })
const admin = postgres(base, { max: 1, onnotice: () => {} })
const sql = postgres(String(url), { max: 1, onnotice: () => {} })

beforeAll(async () => {
  await admin.unsafe(`create database ${name}`)
  await migrate(url)
}, 60_000)

afterAll(async () => {
  await sql.end()
  await admin.unsafe(`drop database ${name} with (force)`)
  await admin.end()
})

describe('migrations (T-05a)', () => {
  it('create every cross-cutting table on a blank database', async () => {
    const tables = ['outbox', 'processed_messages', 'site_settings', 'audit_log', 'rate_limit_counters', 'donations']
    const found = await sql`select tablename from pg_tables where schemaname = 'public'`
    expect(found.map((t) => t.tablename).sort()).toEqual(tables.sort())
  })

  it('can run again without applying anything', async () => {
    await expect(migrate(url)).resolves.toBeUndefined()
  })

  it('generate UUID v7 keys by default', async () => {
    const [row] = await sql`insert into outbox (topic, payload) values ('t', '{}') returning id`
    expect(row!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('give the application role no UPDATE, DELETE or TRUNCATE on audit_log', async () => {
    const can = async (table: string, privilege: string) =>
      (await sql`select has_table_privilege('app_rw', ${table}, ${privilege}) as ok`)[0]!.ok
    expect(await can('audit_log', 'INSERT')).toBe(true)
    expect(await can('audit_log', 'SELECT')).toBe(true)
    expect(await can('audit_log', 'UPDATE')).toBe(false)
    expect(await can('audit_log', 'DELETE')).toBe(false)
    expect(await can('audit_log', 'TRUNCATE')).toBe(false)
    expect(await can('outbox', 'UPDATE')).toBe(true)
  })

  it('seed the base settings: donations stay disabled', async () => {
    const [setting] = await sql`select value from site_settings where key = 'features.donations'`
    expect(setting!.value).toBe(false)
  })

  it('empty every table of the preview template except the site settings, without their author', async () => {
    const author = '0197a000-0000-7000-8000-000000000001'
    await sql`insert into outbox (topic, payload) values ('emails', '{"to":"someone@example.com"}')`
    await sql`insert into audit_log (actor_id, action, target_type, target_id) values (${author}, 'ban', 'user', '1')`
    await sql`update site_settings set updated_by = ${author}`
    await emptyData(url)
    for (const table of ['outbox', 'processed_messages', 'audit_log', 'rate_limit_counters', 'donations'])
      expect((await sql.unsafe(`select count(*)::int as n from ${table}`))[0]!.n).toBe(0)
    expect(await sql`select key, updated_by from site_settings`).toEqual([
      { key: 'features.donations', updated_by: null },
    ])
  })

  it('connect the Worker with a plain login role that can insert into audit_log but never update or delete it', async () => {
    const appUrl = await setAppRole(url)
    expect(appUrl.username).toBe('ls_app')
    const app = postgres(String(appUrl), { max: 1, onnotice: () => {} })
    try {
      const [role] = await app`select rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname = current_user`
      expect(role).toEqual({ rolsuper: false, rolcreaterole: false, rolcreatedb: false })
      await app`insert into audit_log (action, target_type, target_id) values ('test', 'photo', '1')`
      await expect(app`update audit_log set action = 'forged'`).rejects.toThrow(/permission denied/)
      await expect(app`delete from audit_log`).rejects.toThrow(/permission denied/)
      await expect(app`truncate audit_log`).rejects.toThrow(/permission denied/)
      await app`update outbox set topic = topic` // the other tables stay writable
    } finally {
      await app.end()
    }
  })
})
