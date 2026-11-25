import type { Clock } from '../../server/platform/clock'
import type { MediaRepository, Processed } from '../../server/modules/media'

type Row = {
  id: string
  userId: string
  mime: string
  bytes: number
  createdAt: Date
  uploadedAt: Date | null
  title: string | null
  gameVersion: string | null
  status: string
  processed?: Processed
}

/** In-memory MediaRepository for use case tests; `rows` shows the captures. */
export function inMemoryMediaRepository(clock: Clock) {
  const rows = new Map<string, Row>()
  const repo: MediaRepository = {
    async createUpload({ id, userId, mime, bytes }) {
      rows.set(id, {
        id,
        userId,
        mime,
        bytes,
        createdAt: clock.now(),
        uploadedAt: null,
        title: null,
        gameVersion: null,
        status: 'processing',
      })
    },
    async countIncomplete(userId, since) {
      return [...rows.values()].filter((r) => r.userId === userId && !r.uploadedAt && r.createdAt >= since).length
    },
    async findUpload(id) {
      const row = rows.get(id)
      return row
        ? {
            id,
            userId: row.userId,
            mime: row.mime,
            bytes: row.bytes,
            status: row.status,
            uploadedAt: row.uploadedAt,
            title: row.title,
          }
        : null
    },
    async complete(id, { title, gameVersion, at }) {
      const row = rows.get(id)
      if (!row || row.uploadedAt) return false
      Object.assign(row, { title, gameVersion, uploadedAt: at })
      return true
    },
    async incompleteBefore(before, limit) {
      return [...rows.values()]
        .filter((r) => !r.uploadedAt && r.createdAt < before)
        .slice(0, limit)
        .map((r) => r.id)
    },
    async deleteIncomplete(id) {
      if (!rows.get(id)?.uploadedAt) rows.delete(id)
    },
    async finishProcessing(id, status, processed) {
      const row = rows.get(id)
      if (row?.status !== 'processing') return false
      Object.assign(row, { status, processed, bytes: processed.bytes })
      return true
    },
    async titles(ids) {
      return new Map(ids.filter((id) => rows.has(id)).map((id) => [id, rows.get(id)!.title]))
    },
    async failProcessing(id) {
      const row = rows.get(id)
      if (row?.status !== 'processing') return false
      row.status = 'failed'
      return true
    },
  }
  return { repo, rows }
}
