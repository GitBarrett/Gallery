import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { createHash } from 'node:crypto'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { betaInvites, users } from '../../server/db/schema'
import { TURNSTILE_DUMMY_TOKEN } from '../../server/modules/identity'
import { totpAt } from '../../server/modules/identity/domain/totp'
import { MfaSetupResponse, MfaVerifyResponse } from '../../shared/contracts/auth'

// Staff TOTP over HTTP and Postgres (US-55.2, US-55.5): setup, sign-in challenge, recovery codes, replay, throttling.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const staff = { email: `mfa.${run}@example.com`, username: `mfa_${run}`, password: `a long passphrase ${run}` }

const post = (path: string, body: unknown, cookie = '') =>
  fetch(path, {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'cf-connecting-ip': crypto.randomUUID(),
      cookie,
    },
    body: JSON.stringify(body),
  })
const cookieOf = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0]!
const signin = async () => cookieOf(await post('/api/auth/signin', { email: staff.email, password: staff.password }))
const step = () => Math.floor(Date.now() / 30_000)
const me = (cookie: string) => fetch('/api/me', { headers: { cookie } })
let secret = ''
let recoveryCodes: string[] = []

beforeAll(async () => {
  const token = crypto.randomUUID()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.insert(betaInvites).values({ emailHmac: 'mfa-test', tokenHash, expiresAt: new Date(Date.now() + 3600_000) })
  await post('/api/auth/signup', {
    ...staff,
    termsAccepted: true,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
    inviteToken: token,
  })
  await db.update(users).set({ role: 'moderator' }).where(eq(users.email, staff.email))
})

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'mfa.%@example.com'))
  await db.delete(betaInvites).where(eq(betaInvites.emailHmac, 'mfa-test'))
  await db.$client.end()
})

describe('staff TOTP (API)', () => {
  it('US-55.2 leads a moderator without TOTP to enable it, with 10 recovery codes, then a new session', async () => {
    const pending = await signin()
    const setup = await post('/api/auth/mfa/setup', {}, pending)
    expect(setup.status).toBe(200)
    ;({ secret } = MfaSetupResponse.parse(await setup.json()))
    const [row] = await db.select().from(users).where(eq(users.email, staff.email))
    expect(row!.mfaTotpSecretEnc).not.toContain(secret) // sealed with MFA_ENCRYPTION_KEY
    const verified = await post('/api/auth/mfa/verify', { code: await totpAt(secret, step() - 1) }, pending)
    expect(verified.status).toBe(200)
    ;({ recoveryCodes = [] } = MfaVerifyResponse.parse(await verified.json()))
    expect(recoveryCodes).toHaveLength(10)
    expect((await me(pending)).status).toBe(401) // a new id at this privilege change
    expect((await me(cookieOf(verified))).status).toBe(200)
    expect((await post('/api/auth/mfa/setup', {}, cookieOf(verified))).status).toBe(403)
  })

  it('US-55.2 asks the TOTP at the next sign-in and refuses the same code twice', async () => {
    const pending = await signin()
    const code = await totpAt(secret, step())
    expect((await post('/api/auth/mfa/challenge', { code }, pending)).status).toBe(204)
    const again = await post('/api/auth/mfa/challenge', { code }, await signin())
    expect(again.status).toBe(400)
    expect((await again.json()).error.details).toMatchObject({ field: 'code', reason: 'wrong' })
  })

  it('US-55.5 signs in with a recovery code, once', async () => {
    const verified = await post('/api/auth/mfa/challenge', { code: recoveryCodes[0] }, await signin())
    expect(verified.status).toBe(204)
    expect((await post('/api/auth/mfa/challenge', { code: recoveryCodes[0] }, await signin())).status).toBe(400)
  })

  it('US-55.2 blocks the TOTP of the account after 5 failures', async () => {
    const pending = await signin()
    // 2 failures above (the replayed TOTP code and the reused recovery code): 3 more reach the 5
    for (let i = 0; i < 3; i++)
      expect((await post('/api/auth/mfa/challenge', { code: '000000' }, pending)).status).toBe(400)
    expect((await post('/api/auth/mfa/challenge', { code: recoveryCodes[1] }, pending)).status).toBe(429)
  })
})
