import { ProfileParams, type ProfileResponse } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'

// Public profile (US-05.3), open to everyone (08-securite.md annexe B); 404 for an unknown, banned or deleted account.
export default defineEventHandler(async (event): Promise<ProfileResponse> => {
  const { username } = await getValidatedRouterParams(event, ProfileParams.parse)
  const profile = orThrow(await event.context.container.identity.getProfile({ username }))
  return { ...profile, memberSince: profile.memberSince.toISOString() }
})
