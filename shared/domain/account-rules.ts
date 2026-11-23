import { err, ok, type Result } from './result'

// Account rules shared by the forms and the server (08-securite.md § 3, 04-user-stories.md US-01, US-05).

export type UsernameProblem = 'length' | 'charset' | 'reserved' | 'insult'
export type PasswordProblem = 'too_short' | 'too_long'

// Staff names and every top-level route of the site (03-architecture.md, 02-specs-fonctionnelles.md)
const RESERVED = new Set(
  'admin administrator moderator mod staff support help root system api img avatar u v fr en settings upload search notifications following leaderboard contests legal terms privacy cookies offline manifest robots sitemap sw share-target storybook signin signup login logout reset verify-email'.split(
    ' ',
  ),
)

// shortcut: local EN/FR list (Q8, Q41), matched as substrings, no leetspeak; switch to a maintained list when Q8
// is decided. Words hidden in common ones are left out: cock (peacock), nique (unique), pedo (torpedo), cum (document).
const INSULTS =
  'fuck shit cunt bitch bastard asshole dickhead wanker twat whore slut pussy retard nigger nigga faggot tranny kike rapist porn dildo jizz penis vagina nazi hitler connard connasse salope salaud encule batard putain merde couille branleur trouduc niquer tapette gouine bougnoule youpin pedophile'.split(
    ' ',
  )

export function validateUsername(name: string): Result<string, UsernameProblem> {
  if (name.length < 3 || name.length > 24) return err('length')
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return err('charset')
  const lower = name.toLowerCase()
  if (RESERVED.has(lower)) return err('reserved')
  if (hasInsult(lower)) return err('insult')
  return ok(name)
}

/** Insult filter of usernames, also applied to the identifiers of social networks (US-82.2). */
export const hasInsult = (text: string) => INSULTS.some((word) => text.toLowerCase().includes(word))

export function validatePassword(password: string): Result<string, PasswordProblem> {
  const length = [...password].length // code points: an emoji counts as one character
  if (length < 10) return err('too_short')
  if (length > 128) return err('too_long')
  return ok(password)
}
