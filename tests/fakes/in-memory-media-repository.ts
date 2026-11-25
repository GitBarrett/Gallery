import type { Clock } from '../../server/platform/clock'
import type { CaptureDetails, DetailsChanges, MediaRepository, Processed } from '../../server/modules/media'

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
  const sizes = new Map<string, { width: number; height: number }>() // apart: the rows compare as before
  const captureDetails = new Map<string, CaptureDetails>()
  const edits = new Map<string, DetailsChanges>() // the changes of the edits, merged (US-12.1)
  const repo: MediaRepository = {
    async createUpload({ id, userId, mime, bytes, width, height }) {
      sizes.set(id, { width, height })
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
    async complete(id, { title, gameVersion, at, details }) {
      const row = rows.get(id)
      if (!row || row.uploadedAt) return false
      Object.assign(row, { title, gameVersion, uploadedAt: at })
      if (details) captureDetails.set(id, details)
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
    async listOwn(userId, { before, limit }) {
      return [...rows.values()]
        .filter((r) => r.userId === userId && r.uploadedAt && (!before || r.id < before))
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, limit)
        .map((r) => ({ id: r.id, title: r.title, status: r.status, ...sizes.get(r.id)!, uploadedAt: r.uploadedAt! }))
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
    async updateDetails(id, { metadata, tagIds, ...fields }) {
      const current = edits.get(id) ?? {}
      edits.set(id, {
        ...current,
        ...fields,
        metadata: { ...current.metadata, ...metadata },
        ...(tagIds && { tagIds }),
      })
      if (fields.title) rows.get(id)!.title = fields.title
    },
    async findDetails(id) {
      const row = rows.get(id)
      if (!row?.uploadedAt) return null
      const done = captureDetails.get(id)
      const edited = edits.get(id)
      const pick = <T>(key: string, fallback: T) => ((edited as Record<string, unknown>)?.[key] ?? fallback) as T
      return {
        id,
        userId: row.userId,
        status: row.status,
        title: row.title,
        ...sizes.get(id)!,
        description: pick('description', done?.description ?? null),
        altText: pick('altText', done?.altText ?? null),
        focalX: pick('focalX', done?.focalX ?? null),
        focalY: pick('focalY', done?.focalY ?? null),
        zoneId: done?.zoneId ?? null,
        zoneCustom: done?.zoneCustom ?? null,
        inGameTime: done?.inGameTime ?? null,
        graphicsSettings: done?.graphicsSettings ?? null,
        characterName: done?.characterName ?? null,
        caption: done?.caption ?? null,
        tagIds: edited?.tagIds ?? done?.tagIds ?? [],
      }
    },
    async deleteCapture(id) {
      return rows.delete(id)
    },
  }
  return { repo, rows, captureDetails, edits }
}
