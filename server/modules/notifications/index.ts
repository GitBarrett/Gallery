// notifications module (03-architecture.md § Modules): creation, likes grouping, preferences, retention.
export { notify, purgeNotifications, type NotificationEvent } from './application/notify'
export type { NewNotification, NotificationsRepository } from './application/ports'
export { drizzleNotificationsRepository } from './infrastructure/drizzle-notifications-repository'
export { notificationsConsumer } from './interface/notifications-consumer'
