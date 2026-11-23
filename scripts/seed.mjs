// Local demo data (T-04e), on DATABASE_URL (.env: the ls_dev database of scripts/local-postgres.sh):
//   pnpm db:seed   applies the migrations, then creates the test account if missing and a fresh beta invitation
// Never for production or previews: refused when DATABASE_URL is not on localhost.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { argon2id } from '@noble/hashes/argon2.js'
import postgres from 'postgres'
import { migrate } from './database.mjs'

export const SEED_ACCOUNT = { email: 'ash@example.com', username: 'Ash_Barrett', password: 'a long passphrase' }

/** PHC string with the parameters of ADR-015, as argon2idHasher writes it. */
export function phc(password, salt = randomBytes(16)) {
  const m = 19_456
  const hash = argon2id(new TextEncoder().encode(password), salt, { m, t: 2, p: 1, dkLen: 32 })
  const b64 = (bytes) => Buffer.from(bytes).toString('base64').replace(/=+$/, '')
  return `$argon2id$v=19$m=${m},t=2,p=1$${b64(salt)}$${b64(hash)}`
}

async function seed(url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('seed: local databases only')
  await migrate(url)
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const { email, username, password } = SEED_ACCOUNT
    await sql`
      insert into users (email, email_verified_at, password_hash, username, terms_accepted_at, terms_version)
      values (${email}, now(), ${phc(password)}, ${username}, now(), 'seed')
      on conflict do nothing`
    const token = randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await sql`
      insert into beta_invites (email_hmac, token_hash, expires_at)
      values ('seed', ${tokenHash}, now() + interval '14 days')`
    console.log(`Account: ${email} / ${password} (${username}, email verified)`)
    console.log(`Invitation: http://localhost:3000/signup?invite=${token}`)
  } finally {
    await sql.end()
  }
}

if (process.argv[1]?.endsWith('seed.mjs')) {
  process.loadEnvFile?.('.env')
  await seed(process.env.DATABASE_URL ?? '')
}
