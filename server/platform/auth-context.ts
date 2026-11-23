import { defineEventHandler as definePortableHandler, useSession } from 'nuxt/server'
import type { H3Event } from 'h3'
import type { Actor, PendingOAuth } from '../modules/identity'
import { AppError } from './http-errors'

declare module '#auth-utils' {
  // Only the random id of the session travels, sealed; never exposed by /api/_auth/session (ADR-010)
  interface SecureSessionData {
    sessionId: string
  }
}

/** Session id of the sealed cookie. Unread without the cookie: reading creates a session cookie for a visitor. */
export async function sessionIdOf(event: H3Event): Promise<string | undefined> {
  const cookie = useRuntimeConfig(event).session.name
  if (!cookie || !getCookie(event, cookie)) return undefined
  return (await getUserSession(event)).secure?.sessionId
}

/** Seals a new session id into the cookie (30 days, `__Host-`, HttpOnly, Secure, SameSite=Lax: nuxt.config). */
export async function startCookieSession(event: H3Event, sessionId: string): Promise<void> {
  await replaceUserSession(event, { secure: { sessionId } })
}

export const endCookieSession = (event: H3Event) => clearUserSession(event)

/**
 * Member of the request (10-clean-architecture.md § 3), checked in the database at each request (ADR-010): null
 * for a visitor or an unknown, revoked, expired or ended session, whose cookie is then deleted.
 */
export async function getContext(event: H3Event) {
  const { container, correlationId } = event.context
  const sessionId = await sessionIdOf(event)
  const resolved = sessionId ? await container.identity.resolveSession({ sessionId }) : null
  if (sessionId && !resolved) await endCookieSession(event)
  if (sessionId && resolved?.refreshed) await startCookieSession(event, sessionId) // the 30 days restart
  return { container, correlationId, actor: resolved?.actor ?? null }
}

/** Same as getContext, 401 without a valid session (US-03.5). */
export async function requireContext(
  event: H3Event,
): Promise<Awaited<ReturnType<typeof getContext>> & { actor: Actor }> {
  const ctx = await getContext(event)
  if (!ctx.actor) throw new AppError('UNAUTHENTICATED', 'Sign in required')
  return { ...ctx, actor: ctx.actor }
}

const OAUTH_COOKIE = '__Host-ls-oauth'
// The H3 event as the event of nuxt/server, as nuxt-auth-utils does for the session cookie
const portable = definePortableHandler((event) => event) as unknown as (
  event: H3Event,
) => Parameters<typeof useSession>[0]

type OAuthFlow = {
  state?: string
  verifier?: string
  locale?: 'en' | 'fr'
  invite?: string
  pending?: PendingOAuth
}

/**
 * Sealed cookie of an OAuth sign-in in progress, 30 min (Q53): state and PKCE verifier until the callback, then
 * the identity waiting for its account or its link. Lax: sent back on the provider's top-level redirect.
 */
export const oauthFlow = (event: H3Event) =>
  useSession<OAuthFlow>(portable(event), {
    name: OAUTH_COOKIE,
    maxAge: 1800,
    cookie: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
  })

/** Data of the OAuth sign-in in progress, read without creating the cookie for a visitor. */
export async function oauthFlowOf(event: H3Event): Promise<OAuthFlow> {
  return getCookie(event, OAUTH_COOKIE) ? (await oauthFlow(event)).data : {}
}
