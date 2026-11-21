import type { RateLimitBinding } from './workers-rate-limiter'

/**
 * Cloudflare bindings used by the application (wrangler.toml), typed as narrowly as possible, without Workers types.
 * Absent in local development and in Node integration tests.
 */
export interface QueueProducer {
  send(body: unknown): Promise<unknown>
}

export interface Bindings {
  HYPERDRIVE?: { connectionString: string }
  R2?: { head(key: string): Promise<unknown> }
  PHOTO_PROCESS_QUEUE?: QueueProducer
  NOTIFICATIONS_QUEUE?: QueueProducer
  EMAILS_QUEUE?: QueueProducer
  FEEDBACK_QUEUE?: QueueProducer
  ACCOUNT_PURGE_QUEUE?: QueueProducer
  RATE_LIMITER_MUTATIONS?: RateLimitBinding
}
