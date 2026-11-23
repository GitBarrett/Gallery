import type { SocialPlatform } from '~~/shared/domain/social-links'

/** Brand names of the networks (not translated); the website has its i18n label, `profile.website`. */
export const SOCIAL_NAMES: Record<Exclude<SocialPlatform, 'website'>, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  x: 'X',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  discord: 'Discord',
}
