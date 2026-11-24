import { err, ok, type Result } from '../../../../shared/domain/result'
import type { Clock } from '../../../platform/clock'
import type { NotificationType } from '../domain/notifications'
import type { NotificationsRepository, StoredNotification } from './ports'

// Reading side of the Quest log (US-35.3), open to every member on their own notifications only (08-securite.md
// annexe B, row `/api/notifications*`): the actor is always the signed-in member, another's entry is not found.

export interface NotificationView {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actor: string | null
  others: number
  photoId: string | null
  photoTitle: string | null
  detail: string | null
}

type Payload = {
  actorId?: string
  actorIds?: string[]
  photoId?: string
  outcome?: string
  quality?: string
  event?: string
}

// shortcut: the 50 latest only, no paging; enough while a member gets few notifications (6-month retention), add a
// cursor when the Quest log gets a "Load more"
export const QUEST_LOG_SIZE = 50

const actorsOf = (p: Payload) => p.actorIds ?? (p.actorId ? [p.actorId] : [])

/**
 * The latest notifications of the member, with the usernames and titles of now (Q69). An entry whose members or
 * capture are all gone (deleted account, deleted capture) is left out.
 */
export const listNotifications =
  (deps: {
    repo: NotificationsRepository
    usernames: (ids: string[]) => Promise<Map<string, string>>
    titles: (ids: string[]) => Promise<Map<string, string | null>>
  }) =>
  async (cmd: { userId: string }): Promise<NotificationView[]> => {
    const rows = await deps.repo.list(cmd.userId, QUEST_LOG_SIZE)
    const payloads = rows.map((r) => r.payload as Payload)
    const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))]
    const [names, titles] = await Promise.all([
      deps.usernames(unique(payloads.flatMap(actorsOf))),
      deps.titles(unique(payloads.map((p) => p.photoId))),
    ])
    return rows.flatMap((row, i) => viewOf(row, payloads[i]!, names, titles) ?? [])
  }

/** The entry as shown, or null when its members or its capture are gone. */
function viewOf(
  row: StoredNotification,
  p: Payload,
  names: Map<string, string>,
  titles: Map<string, string | null>,
): NotificationView | null {
  const actors = actorsOf(p).filter((id) => names.has(id))
  if (actorsOf(p).length && !actors.length) return null
  const photoId = p.photoId ?? null
  if (photoId && !titles.has(photoId)) return null
  const latest = actors.at(-1)
  return {
    id: row.id,
    type: row.type,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
    actor: latest ? names.get(latest)! : null,
    others: Math.max(actors.length - 1, 0),
    photoId,
    photoTitle: titles.get(photoId ?? '') ?? null,
    detail: detailOf(p),
  }
}

const detailOf = (p: Payload) => p.outcome ?? p.quality ?? p.event ?? null

/** The bell's counter (US-35.1). */
export const unreadCount = (deps: { repo: NotificationsRepository }) => (cmd: { userId: string }) =>
  deps.repo.countUnread(cmd.userId)

export const markRead =
  (deps: { repo: NotificationsRepository; clock: Clock }) =>
  async (cmd: { userId: string; id: string }): Promise<Result<void, { kind: 'not_found' }>> =>
    (await deps.repo.markRead(cmd.userId, cmd.id, deps.clock.now())) ? ok(undefined) : err({ kind: 'not_found' })

export const markAllRead = (deps: { repo: NotificationsRepository; clock: Clock }) => (cmd: { userId: string }) =>
  deps.repo.markAllRead(cmd.userId, deps.clock.now())
