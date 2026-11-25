import type { ObjectStorage } from './ports'

/** Where a removed object waits 30 days before the R2 lifecycle deletes it (US-12.2, restore runbook). */
export const trashKey = (key: string) => `trash/${key}`

/** Moves an object to `trash/`; does nothing for a missing key (a replay after the move). */
export async function moveToTrash(storage: ObjectStorage, key: string): Promise<void> {
  const stored = await storage.head(key)
  const body = stored && (await storage.read(key))
  if (!stored || !body) return
  await storage.put(trashKey(key), body, { bytes: stored.bytes, contentType: stored.contentType ?? 'application/octet-stream' })
  await storage.delete(key)
}
