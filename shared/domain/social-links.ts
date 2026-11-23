import { hasInsult } from './account-rules'
import { err, ok, type Result } from './result'

// Social networks of a profile (US-82, 08-securite.md § 4): only an identifier is stored, never a free URL except
// the website; links are built from these fixed templates. Shared by the settings form (T-17a) and the server.

export const SOCIAL_PLATFORMS = [
  'twitch',
  'youtube',
  'x',
  'bluesky',
  'instagram',
  'tiktok',
  'reddit',
  'discord',
  'website',
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
export type SocialHandleProblem = 'format' | 'insult'

// Formats of US-82.2 (Twitch, YouTube, Bluesky) and of each network's own rules for the others (Q57)
const FORMATS: Record<Exclude<SocialPlatform, 'website'>, RegExp> = {
  twitch: /^[a-zA-Z0-9_]{4,25}$/,
  youtube: /^@[A-Za-z0-9._-]{3,30}$/,
  x: /^[A-Za-z0-9_]{1,15}$/,
  bluesky: /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  reddit: /^[A-Za-z0-9_-]{3,20}$/,
  discord: /^[a-z0-9._]{2,32}$/,
}

const TEMPLATES: Record<Exclude<SocialPlatform, 'website' | 'discord'>, (handle: string) => string> = {
  twitch: (h) => `https://twitch.tv/${h}`,
  youtube: (h) => `https://youtube.com/${h}`,
  x: (h) => `https://x.com/${h}`,
  bluesky: (h) => `https://bsky.app/profile/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  reddit: (h) => `https://reddit.com/user/${h}`,
}

// shortcut: short list of the best-known shorteners (US-82.3), extend it when moderation reports others
const SHORTENERS = new Set(
  'bit.ly tinyurl.com t.co goo.gl ow.ly is.gd buff.ly rebrand.ly cutt.ly shorturl.at tiny.cc rb.gy t.ly s.id'.split(
    ' ',
  ),
)

function websiteHost(value: string): string | null {
  if (value.length > 200 || !URL.canParse(value)) return null
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if (host.startsWith('[') || /^[\d.]+$/.test(host) || !host.includes('.')) return null // IPv6, IPv4, local name
  if (SHORTENERS.has(host.replace(/^www\./, ''))) return null
  return host
}

export function validateSocialHandle(platform: SocialPlatform, handle: string): Result<string, SocialHandleProblem> {
  const valid = platform === 'website' ? websiteHost(handle) !== null : FORMATS[platform].test(handle)
  if (!valid) return err('format')
  if (hasInsult(handle)) return err('insult')
  return ok(handle)
}

/** Label and link of a stored identifier (US-82.4): Discord has no link, a website shows its domain only. */
export function socialLink(platform: SocialPlatform, handle: string): { label: string; url: string | null } | null {
  if (!validateSocialHandle(platform, handle).ok) return null // never a link from a value the rules now refuse
  if (platform === 'website') return { label: websiteHost(handle)!, url: handle }
  if (platform === 'discord') return { label: handle, url: null }
  return { label: handle, url: TEMPLATES[platform](handle) }
}
