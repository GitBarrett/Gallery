import type { RateLimitBinding } from './workers-rate-limiter'

/**
 * Bindings Cloudflare utilisés par l'application (wrangler.toml), typés au plus juste, sans dépendre des types Workers.
 * Absents en développement local et dans les tests d'intégration Node.
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
