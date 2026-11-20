import { toErrorResponse } from './platform/http-errors'

// Erreurs de /api au format commun ; les pages gardent la page d'erreur de Nuxt (T-07c).
export default defineNitroErrorHandler((error, event) => {
  if (!event.path.startsWith('/api/')) return
  const { status, body } = toErrorResponse(error, event.context.correlationId ?? 'unknown')
  if (status === 500) event.context.container?.logger.error('unexpected error', { error: error.cause ?? error })
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', 'application/json')
  return send(event, JSON.stringify(body))
})
