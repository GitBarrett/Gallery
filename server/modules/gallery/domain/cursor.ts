// Opaque cursor of the grids (03 § Conventions d'API): the position of the last capture of a page in its sort order
// — the sort key (likes or downloads, 0 for the recent sort), the publication date, then the id (UUID v7) that breaks
// ties. Captures published meanwhile come before it, so the next page neither repeats nor skips one.
import type { GridSort } from '../../../../shared/domain/grid-sort'

export type { GridSort }

export interface GridPosition {
  key: number
  publishedAt: Date
  id: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const toBase64Url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (text: string) => atob(text.replace(/-/g, '+').replace(/_/g, '/'))

export const encodeCursor = (sort: GridSort, at: GridPosition) =>
  toBase64Url(JSON.stringify([sort, at.key, at.publishedAt.toISOString(), at.id]))

/** The position of a cursor given for this sort; null when it was altered or made for another sort. */
export function decodeCursor(sort: GridSort, cursor: string): GridPosition | null {
  try {
    const [s, key, publishedAt, id] = JSON.parse(fromBase64Url(cursor)) as unknown[]
    const date = new Date(String(publishedAt))
    const valid = s === sort && Number.isInteger(key) && !Number.isNaN(date.getTime()) && UUID.test(String(id))
    return valid ? { key: key as number, publishedAt: date, id: id as string } : null
  } catch {
    return null
  }
}
