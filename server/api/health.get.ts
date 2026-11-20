import type { HealthResponse } from '../../shared/contracts/health'

// Base, R2 et Queue s'ajoutent avec leurs tâches (T-03a, T-05a)
export default defineEventHandler((): HealthResponse => ({ status: 'ok' }))
