import { toErrorResponse } from './http-errors'

/**
 * Données envoyées à Sentry côté serveur (08-securite.md § 7, aucune donnée personnelle) : ni utilisateur, ni cookies,
 * ni corps, ni query, ni variables locales ; seuls quelques en-têtes techniques de la requête.
 */
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpBodies: [],
  urlQueryParams: false,
  httpHeaders: { request: { allow: ['accept', 'content-type', 'user-agent'] }, response: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
}

/** Seules les erreurs inattendues (réponse 5xx) sont envoyées ; les 4xx sont le fonctionnement normal de l'API. */
export function beforeSend<E>(event: E, hint: { originalException?: unknown }): E | null {
  if (hint.originalException !== undefined && toErrorResponse(hint.originalException, '').status < 500) return null
  return event
}
