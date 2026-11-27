/** Counters (likes, downloads, comments) are shown from this value on; never a small number (US-70.6, 07 § États vides). */
export const COUNTER_MIN = 10
/** A capture is « New » this long after its publication (US-70.6). */
export const NEW_FOR_MS = 7 * 24 * 60 * 60_000

/** Whether a counter is shown. */
export const shownCount = (count: number) => count >= COUNTER_MIN

/** Whether a capture published at `publishedAt` (ISO or Date) still carries the « New » badge at `now`. */
export const isNew = (publishedAt: string | Date, now = new Date()) =>
  now.getTime() - new Date(publishedAt).getTime() < NEW_FOR_MS
