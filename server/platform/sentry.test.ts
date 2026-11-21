import { describe, expect, it } from 'vitest'
import { AppError } from './http-errors'
import { beforeSend } from './sentry'

// h3 enveloppe l'erreur lancée par une route : l'erreur d'origine est dans `cause`
const thrownByRoute = (error: Error) => Object.assign(new Error(error.message), { statusCode: 500, cause: error })

describe('beforeSend (08-securite.md § 7)', () => {
  it('drops expected errors that become a 4xx response', () => {
    expect(beforeSend({}, { originalException: thrownByRoute(new AppError('NOT_FOUND', 'x')) })).toBeNull()
    expect(beforeSend({}, { originalException: Object.assign(new Error('x'), { statusCode: 404 }) })).toBeNull()
  })

  it('keeps unexpected errors and events without exception, such as messages', () => {
    const event = { message: 'boom' }
    expect(beforeSend(event, { originalException: thrownByRoute(new Error('boom')) })).toBe(event)
    expect(beforeSend(event, {})).toBe(event)
  })
})
