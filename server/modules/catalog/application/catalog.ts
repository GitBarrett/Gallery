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
  /** Id of the active zone of this slug, null otherwise. */
  zoneId(slug: string): Promise<string | null>
  /** Ids of the normalised tags `slugs`, in their order, the missing ones created. */
  ensureTags(slugs: string[]): Promise<string[]>
  /** The zone of this id, whatever its status; null if gone. */
  zoneById(id: string): Promise<Zone | null>
  /** Slugs of the tags of these ids, in their order. */
  tagSlugs(ids: string[]): Promise<string[]>
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

/** Zone chosen in the upload form (US-11.2): its id, null when it is not an active zone of the dictionary. */
export const findZone = (deps: { repo: CatalogRepository }) => (slug: string) => deps.repo.zoneId(slug)

/** Tags of a capture (US-11.1), already validated by shared/domain/tags: their ids, new ones created. */
export const ensureTags = (deps: { repo: CatalogRepository }) => (slugs: string[]) => deps.repo.ensureTags(slugs)

/** Names of a capture's zone and tags, for its edit form (US-12.1). */
export const zoneById = (deps: { repo: CatalogRepository }) => (id: string) => deps.repo.zoneById(id)
export const tagSlugs = (deps: { repo: CatalogRepository }) => (ids: string[]) => deps.repo.tagSlugs(ids)
