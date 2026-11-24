import { normalizeTag } from '../../../../shared/domain/tags'

/** A version of the game offered in the catalogue (02 § Galerie), names in both languages of the site. */
export interface GameVersion {
  slug: string
  nameEn: string
  nameFr: string
}

/** A zone of the dictionary (US-57), names in both languages of the site. */
export interface Zone {
  slug: string
  nameEn: string
  nameFr: string
}

/** Port: game versions, zones and tags of the catalogue. */
export interface CatalogRepository {
  /** Versions not archived, in their display order. */
  listGameVersions(): Promise<GameVersion[]>
  /** Normalised tags starting with `prefix` (itself normalised), alphabetical, `limit` at most. */
  suggestTags(prefix: string, limit: number): Promise<string[]>
  /** Active zones whose names or aliases hold `text` (normalised), closest first, `limit` at most. */
  suggestZones(text: string, limit: number): Promise<Zone[]>
}

const SUGGESTIONS = 10
// A prefix that no tag can start with (Q65 charset): answered without a query
const POSSIBLE_PREFIX = /^[a-z0-9][a-z0-9 -]*$/

/** Game versions of the upload form and the gallery filters, open to every visitor. */
export const listGameVersions = (deps: { repo: CatalogRepository }) => () => deps.repo.listGameVersions()

/** Existing tags completing what the member types (US-11.1), open to every visitor. */
export const suggestTags =
  (deps: { repo: CatalogRepository }) =>
  async (cmd: { q: string }): Promise<string[]> => {
    const prefix = normalizeTag(cmd.q)
    return POSSIBLE_PREFIX.test(prefix) ? deps.repo.suggestTags(prefix, SUGGESTIONS) : []
  }

/** Zones of the dictionary completing the Zone field (US-11.2), open to every visitor. */
export const suggestZones =
  (deps: { repo: CatalogRepository }) =>
  async (cmd: { q: string }): Promise<Zone[]> => {
    const text = normalizeTag(cmd.q)
    return text ? deps.repo.suggestZones(text, SUGGESTIONS) : []
  }
