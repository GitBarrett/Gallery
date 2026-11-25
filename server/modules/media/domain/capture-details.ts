import { hasInsult } from '../../../../shared/domain/account-rules'
import { err, ok, type Result } from '../../../../shared/domain/result'
import { TAGS_PER_PHOTO, validateTag } from '../../../../shared/domain/tags'

/** What the member typed in the upload form (US-11), lengths and formats already checked by the contract. */
export interface DetailsInput {
  title: string
  description?: string
  altText?: string
  caption?: string
  zoneCustom?: string
  graphicsSettings?: string
  characterName?: string
  tags?: string[]
}

// Every free text shown to others passes the insult filter (US-11.5 for the title)
const TEXTS = ['title', 'description', 'altText', 'caption', 'zoneCustom', 'graphicsSettings', 'characterName'] as const

/**
 * The details as stored: empty texts dropped, tags normalised once each (US-11.1); or the first field refused, with
 * its reason (`insult`, `length`, `charset`, `too_many`).
 */
export function checkDetails(input: DetailsInput): Result<{ tags: string[] }, { field: string; reason: string }> {
  for (const field of TEXTS) if (input[field] && hasInsult(input[field])) return err({ field, reason: 'insult' })
  const tags: string[] = []
  for (const raw of input.tags ?? []) {
    const tag = validateTag(raw)
    if (!tag.ok) return err({ field: 'tags', reason: tag.error })
    if (!tags.includes(tag.value)) tags.push(tag.value)
  }
  if (tags.length > TAGS_PER_PHOTO) return err({ field: 'tags', reason: 'too_many' })
  return ok({ tags })
}

/** A text left empty is no text. */
export const textOrNone = (text: string | undefined) => (text?.trim() ? text.trim() : undefined)
