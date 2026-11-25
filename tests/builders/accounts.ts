import type { MeResponse, ProfileResponse } from '../../shared/contracts/auth'

// API answers about accounts, built once: a field added to a contract is added here only. `more` overrides.

/** GET /api/me: a verified member without an avatar. */
export const aMe = (more: Partial<MeResponse> = {}): MeResponse => ({
  id: '0193a000-0000-7000-8000-0000000000a1',
  username: 'Ash',
  role: 'user',
  emailVerified: true,
  avatarUrl: null,
  ...more,
})

/** GET /api/users/{username}: a profile without avatar, bio or social link. */
export const aProfile = (more: Partial<ProfileResponse> = {}): ProfileResponse => ({
  username: 'Ash_Barrett',
  avatarUrl: null,
  bio: null,
  memberSince: '2026-11-01T10:00:00.000Z',
  socialLinks: [],
  ...more,
})
