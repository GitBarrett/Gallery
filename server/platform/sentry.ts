import { toErrorResponse } from './http-errors'

/**
 * Data sent to Sentry on the server (08-securite.md § 7, no personal data): no user, cookies,
 * bodies, query or local variables; only a few technical request headers, cf-ray being the correlation id shown on the 500 page.
 */
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpBodies: [],
  urlQueryParams: false,
  httpHeaders: { request: { allow: ['accept', 'content-type', 'user-agent', 'cf-ray'] }, response: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
}

/** Only unexpected errors (5xx response) are sent; 4xx are the normal behaviour of the API. */
export function beforeSend<E>(event: E, hint: { originalException?: unknown }): E | null {
  if (hint.originalException !== undefined && toErrorResponse(hint.originalException, '').status < 500) return null
  return event
}
