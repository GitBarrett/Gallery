import { describe, expect, it, vi } from 'vitest'
import { createContainer } from './container'

describe('createContainer', () => {
  it('tags every log line of the request with its correlation id', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { logger } = createContainer({ config: { siteUrl: 'http://x', fakeProviders: true }, correlationId: 'ray-9' })
    logger.info('hello')
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({ msg: 'hello', correlationId: 'ray-9' })
    log.mockRestore()
  })
})
