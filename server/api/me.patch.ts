import { MeUpdateBody, type MeResponse } from '../../shared/contracts/auth'
import { orThrow } from '../modules/identity'
import { requireContext } from '../platform/auth-context'

// Username, bio and language of the signed-in member (US-05.1, US-05.4, US-07.1; 08-securite.md annexe B, row
// "Compte"): 401 without a session, 429 within 30 days of the last username change, 409 when taken, 400 if invalid,
// 403 for the bio of a suspended member.
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const { container, actor } = await requireContext(event)
  const { username, bio, locale } = await readValidatedBody(event, MeUpdateBody.parse)
  if (bio !== undefined || locale) orThrow(await container.identity.updateProfile({ actor, bio, locale }))
  if (username) orThrow(await container.identity.changeUsername({ userId: actor.id, username }))
  return { id: actor.id, username: username ?? actor.username, role: actor.role, emailVerified: actor.emailVerified }
})
