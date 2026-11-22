import { endCookieSession, sessionIdOf } from '../../platform/auth-context'

// Sign-out (US-03.4): revokes the session server side and deletes the cookie; 204 even without a session.
export default defineEventHandler(async (event) => {
  const sessionId = await sessionIdOf(event)
  if (sessionId) await event.context.container.identity.signout({ sessionId })
  await endCookieSession(event)
  return sendNoContent(event)
})
