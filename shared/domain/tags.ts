import { err, ok, type Result } from './result'

// Tags of a capture (US-11.1), shared by the upload form and the server: 10 at most, 2 to 30 characters, lower
// case without accents. Letters, digits, single spaces and hyphens only (Q65).

export const TAGS_PER_PHOTO = 10
export type TagProblem = 'length' | 'charset'

/** Lower case, accents and ligatures removed, spaces trimmed and collapsed: the form stored and searched. */
export const normalizeTag = (raw: string) =>
  raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .trim()
    .replace(/\s+/g, ' ')

/** The normalised tag, or why it is refused. */
export function validateTag(raw: string): Result<string, TagProblem> {
  const tag = normalizeTag(raw)
  if (tag.length < 2 || tag.length > 30) return err('length')
  if (!/^[a-z0-9]+(?:[ -]+[a-z0-9]+)*$/.test(tag)) return err('charset')
  return ok(tag)
}
