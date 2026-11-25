import { z } from 'zod'
import type { ModerationProvider } from '../application/ports'

// Sightengine (ADR-005, 02-specs § 6): one call per capture with the 3 models, the 1200 px JPEG sent as a file (no
// public URL, 03 § Pipeline image 5). Fixed host (08-securite.md § SSRF).
const ENDPOINT = 'https://api.sightengine.com/1.0/check.json'
const MODELS = 'nudity-2.1,gore-2.0,offensive-2.0'
const TIMEOUT_MS = 15_000

const probability = z.number().min(0).max(1)
// Checked answer (08-securite.md § Validation): the fields the decision reads; the raw answer is kept as is
const Success = z.object({
  status: z.literal('success'),
  nudity: z.object({ sexual_activity: probability, sexual_display: probability, erotica: probability }),
  gore: z.object({ prob: probability }),
  offensive: z.record(z.string(), z.unknown()),
})
const Failure = z.object({ status: z.literal('failure'), error: z.object({ type: z.string(), code: z.number() }) })

/**
 * Max score of the unsafe classes: explicit nudity (sexual activity, sexual display, erotica; suggestive classes such
 * as swimwear are allowed), gore, and every offensive symbol or gesture.
 */
function maxScore(answer: z.infer<typeof Success>): number {
  const offensive = Object.values(answer.offensive)
    .filter((v) => typeof v === 'number')
    .map((v) => probability.parse(v))
  const { sexual_activity, sexual_display, erotica } = answer.nudity
  return Math.max(sexual_activity, sexual_display, erotica, answer.gore.prob, ...offensive)
}

export const sightengineProvider = (deps: {
  apiUser: string
  apiSecret: string
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}): ModerationProvider => ({
  async check(image) {
    const form = new FormData()
    form.append('media', new Blob([image.slice()], { type: 'image/jpeg' }), 'capture.jpg')
    form.append('models', MODELS)
    form.append('api_user', deps.apiUser)
    form.append('api_secret', deps.apiSecret)
    const response = await deps.fetch(ENDPOINT, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const body: unknown = await response.json().catch(() => null)
    const failure = Failure.safeParse(body)
    if (failure.success) throw new Error(`sightengine ${failure.data.error.type} ${failure.data.error.code}`)
    const answer = Success.safeParse(body)
    if (!response.ok || !answer.success) throw new Error(`sightengine unexpected answer (${response.status})`)
    return { score: maxScore(answer.data), raw: body as Record<string, unknown> }
  },
})
