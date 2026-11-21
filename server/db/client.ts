import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Une connexion par requête : le pool est tenu par Hyperdrive ; fetch_types désactivé (T-00e, ADR-016)
export const createDb = (connectionString: string) =>
  drizzle(postgres(connectionString, { max: 1, fetch_types: false }), { schema })

export type Db = ReturnType<typeof createDb>
export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]
