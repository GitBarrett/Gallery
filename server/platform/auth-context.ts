import type { H3Event } from 'h3'
import type { Actor } from '../modules/identity'
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
