// Route inventory of the authorization matrix (08-securite.md § 4 and annexe B, T-18a): every route file of
// server/api and server/routes/auth, its access and its row of annexe B. Deny by default: a route missing here fails
// tests/architecture.test.ts, and tests/api/authorization-matrix.test.ts calls each one as a visitor and as a member.
// `member`: a session is required (`requireContext`, 401 without); the use case then declares the rest (own
// resources, `notSanctioned`, `requireVerified`, `requireRole`…). `public`: open to visitors. `staff`: a session
// too, then `requireStaff` (403 for a member, T-18b). The admin routes (T-18c) add the MFA columns; the owner column
// joins with the first shared resources (T-21).

export type Access = 'public' | 'member' | 'staff'

export const ROUTES: Record<string, { access: Access; row: string }> = {
  'GET /api/health': { access: 'public', row: 'Lectures publiques' },
  'GET /api/settings/public': { access: 'public', row: 'Lectures publiques' },
  'GET /api/game-versions': { access: 'public', row: 'Lectures publiques' },
  'GET /api/tags/suggest': { access: 'public', row: 'Lectures publiques' },
  'GET /api/zones/suggest': { access: 'public', row: 'Lectures publiques' },
  'POST /api/waitlist': { access: 'public', row: 'Auth sans session' },
  'GET /api/usernames/[name]/availability': { access: 'public', row: 'Lectures publiques' },
  'GET /api/users/[username]': { access: 'public', row: 'Lectures publiques' },
  'POST /api/auth/signup': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/signin': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/signout': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/verify-email': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/email/confirm': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/password/forgot': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/password/reset': { access: 'public', row: 'Auth sans session' },
  'GET /api/auth/oauth/pending': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/oauth/complete': { access: 'public', row: 'Auth sans session' },
  'GET /auth/[provider]': { access: 'public', row: 'Auth sans session' },
  'GET /auth/[provider]/callback': { access: 'public', row: 'Auth sans session' },
  'POST /api/auth/resend-verification': { access: 'member', row: 'Compte' },
  'POST /api/auth/mfa/setup': { access: 'staff', row: '`POST /api/auth/mfa/*`' },
  'POST /api/auth/mfa/verify': { access: 'staff', row: '`POST /api/auth/mfa/*`' },
  'POST /api/auth/mfa/challenge': { access: 'staff', row: '`POST /api/auth/mfa/*`' },
  'GET /api/me': { access: 'member', row: 'Compte' },
  'PATCH /api/me': { access: 'member', row: 'Compte' },
  'GET /api/me/account': { access: 'member', row: 'Compte' },
  'POST /api/me/email': { access: 'member', row: 'Compte' },
  'POST /api/me/password': { access: 'member', row: 'Compte' },
  'DELETE /api/me/oauth/[provider]': { access: 'member', row: 'Compte' },
  'GET /api/me/sessions': { access: 'member', row: 'Compte' },
  'DELETE /api/me/sessions/[id]': { access: 'member', row: 'Compte' },
  'POST /api/me/sessions/revoke-others': { access: 'member', row: 'Compte' },
  'GET /api/me/social-links': { access: 'member', row: '`GET/PUT /api/me/social-links`' },
  'PUT /api/me/social-links': { access: 'member', row: '`GET/PUT /api/me/social-links`' },
  // The member's own notifications only (another's: 404), verified or not
  'GET /api/notifications': { access: 'member', row: '`/api/notifications*`' },
  'GET /api/notifications/unread-count': { access: 'member', row: '`/api/notifications*`' },
  'POST /api/notifications/[id]/read': { access: 'member', row: '`/api/notifications*`' },
  'POST /api/notifications/read-all': { access: 'member', row: '`/api/notifications*`' },
  // requireVerified + notSanctioned in the use cases (403 unverified or suspended), the owner's capture only (404)
  'POST /api/photos/upload-url': { access: 'member', row: '`POST /api/photos/upload-url`, `/complete`' },
  'POST /api/photos/[id]/complete': { access: 'member', row: '`POST /api/photos/upload-url`, `/complete`' },
}

/** `server/api/me/sessions/[id].delete.ts` → `DELETE /api/me/sessions/[id]` (Nitro file routing). */
export function routeOf(file: string): string {
  const [, dir, rest] = file.replace(/\\/g, '/').match(/server\/(api|routes)\/(.+)\.ts$/)!
  const [path, method] = rest!.split(/\.(?=[a-z]+$)/)
  const url = `${dir === 'api' ? '/api' : ''}/${path!.replace(/\/?index$/, '')}`
  return `${method!.toUpperCase()} ${url}`
}
