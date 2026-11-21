import { toErrorResponse } from './platform/http-errors'

// /api errors in the common format; pages keep Nuxt's error page (T-07c).
export default defineNitroErrorHandler((error, event) => {
  if (!event.path.startsWith('/api/')) return
  const { status, body, headers } = toErrorResponse(error, event.context.correlationId ?? 'unknown')
  if (status === 500) event.context.container?.logger.error('unexpected error', { error: error.cause ?? error })
  setResponseStatus(event, status)
  setResponseHeaders(event, headers)
  setResponseHeader(event, 'content-type', 'application/json')
  return send(event, JSON.stringify(body))
})
