import { UsernameParams, type UsernameAvailabilityResponse } from '../../../../shared/contracts/auth'

// Live username check (US-05.2), open to everyone (08-securite.md annexe B): usernames are public.
export default defineEventHandler(async (event): Promise<UsernameAvailabilityResponse> => {
  const { name } = await getValidatedRouterParams(event, UsernameParams.parse)
  return event.context.container.identity.usernameAvailability({ username: name })
})
