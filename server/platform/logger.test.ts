import { describe, expect, it } from 'vitest'
import { createLogger } from './logger'

const capture = () => {
  const lines: Record<string, unknown>[] = []
  return { lines, write: (line: string) => lines.push(JSON.parse(line)) }
}

describe('createLogger', () => {
  it('writes one JSON line with level, message, correlation id and module', () => {
    const out = capture()
    createLogger({ correlationId: 'ray-1', module: 'media' }, out.write).info('upload requested', { photoId: 'p1' })
    expect(out.lines).toEqual([
      { level: 'info', msg: 'upload requested', correlationId: 'ray-1', module: 'media', photoId: 'p1' },
    ])
  })

  it('redacts personal data and secrets (CLAUDE.md: no personal data in logs)', () => {
    const out = capture()
    createLogger({ correlationId: 'ray-2' }, out.write).warn('signin failed', {
      email: 'a@b.c',
      password: 'pw',
      accessToken: 't',
      clientSecret: 's',
      ip: '1.2.3.4',
      userId: 'u1',
    })
    expect(out.lines[0]).toMatchObject({
      email: '[redacted]',
      password: '[redacted]',
      accessToken: '[redacted]',
      clientSecret: '[redacted]',
      ip: '[redacted]',
      userId: 'u1',
    })
  })

  it('logs errors by name and message only', () => {
    const out = capture()
    createLogger({ correlationId: 'ray-3' }, out.write).error('unexpected', { error: new TypeError('boom') })
    expect(out.lines[0]).toMatchObject({ level: 'error', error: { name: 'TypeError', message: 'boom' } })
  })
})
