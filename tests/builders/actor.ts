import type { Actor } from '../../server/modules/identity'

/** The signed-in member a use case gets: active, verified, no staff role, no avatar. `more` overrides. */
export const anActor = (more: Partial<Actor> = {}): Actor => ({
  id: '0193a000-0000-7000-8000-0000000000a1',
  username: 'Ash',
  role: 'user',
  status: 'active',
  emailVerified: true,
  mfaVerified: false,
  ...more,
})
