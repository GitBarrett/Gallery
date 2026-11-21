import { describe, expect, it } from 'vitest'

import { ErrorResponse } from '../../shared/contracts/errors'
import { AppError, toErrorResponse } from './http-errors'

// Shape of an h3 (Nitro) error: an Error carrying a statusCode
const createError = ({ statusCode, statusMessage = '' }: { statusCode: number; statusMessage?: string }) =>
  Object.assign(new Error(statusMessage), { statusCode })

describe('toErrorResponse', () => {
  it('maps a business error to its status with the common format', () => {
    const { status, body } = toErrorResponse(new AppError('CONFLICT', 'Username taken', { field: 'username' }), 'ray-1')
    expect(status).toBe(409)
    expect(ErrorResponse.parse(body)).toEqual({
      error: { code: 'CONFLICT', message: 'Username taken', details: { field: 'username' }, correlationId: 'ray-1' },
    })
  })

  it('unwraps a business error that the framework wrapped in a 500', () => {
    const wrapped = Object.assign(new Error('wrapped'), { statusCode: 500, cause: new AppError('FORBIDDEN', 'Nope') })
    expect(toErrorResponse(wrapped, 'ray').status).toBe(403)
  })

  it('maps framework HTTP errors such as an unknown route', () => {
    const { status, body } = toErrorResponse(createError({ statusCode: 404, statusMessage: 'Not Found' }), 'ray-2')
    expect(status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it.each([
    [400, 'VALIDATION_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [429, 'RATE_LIMITED'],
  ] as const)('maps HTTP %i to %s', (statusCode, code) => {
    expect(toErrorResponse(createError({ statusCode }), 'ray').body.error.code).toBe(code)
  })

  it('hides the details of an unexpected error behind a generic 500', () => {
    const { status, body } = toErrorResponse(new Error('connection string postgres://user:secret@db'), 'ray-3')
    expect(status).toBe(500)
    expect(body.error).toEqual({ code: 'INTERNAL', message: 'Internal error', correlationId: 'ray-3' })
  })

  it('tells the client when to retry after a rate limit (08-securite.md § 8)', () => {
    const limited = toErrorResponse(new AppError('RATE_LIMITED', 'Too many requests', { retryAfterSeconds: 42 }), 'r')
    expect(limited.status).toBe(429)
    expect(limited.headers).toEqual({ 'retry-after': '42' })
    expect(toErrorResponse(new AppError('CONFLICT', 'x'), 'r').headers).toEqual({})
  })
})
