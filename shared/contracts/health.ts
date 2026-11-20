import { z } from 'zod'

const CheckStatus = z.enum(['ok', 'fail'])

export const HealthResponse = z.strictObject({
  status: CheckStatus,
  checks: z.record(z.string(), CheckStatus),
})
export type HealthResponse = z.infer<typeof HealthResponse>
