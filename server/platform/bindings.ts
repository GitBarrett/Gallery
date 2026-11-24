import type { ImagesBinding } from '../modules/media'
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
  R2?: {
    head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
    get(
      key: string,
      options?: { range: { offset: number; length: number } },
    ): Promise<{ body: ReadableStream<Uint8Array>; text(): Promise<string> } | null>
    put(
      key: string,
      value: string | ReadableStream<Uint8Array> | Uint8Array,
      options?: { httpMetadata: { contentType: string } },
    ): Promise<unknown>
    delete(key: string): Promise<void>
  }
  IMAGES?: ImagesBinding
  PHOTO_PROCESS_QUEUE?: QueueProducer
  NOTIFICATIONS_QUEUE?: QueueProducer
  EMAILS_QUEUE?: QueueProducer
  FEEDBACK_QUEUE?: QueueProducer
  ACCOUNT_PURGE_QUEUE?: QueueProducer
  RATE_LIMITER_MUTATIONS?: RateLimitBinding
}
