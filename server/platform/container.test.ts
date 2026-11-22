import { describe, expect, it, vi } from 'vitest'
import { LAUNCH_SETTINGS } from '../modules/settings'
import { createContainer } from './container'

const config = { siteUrl: 'http://x', fakeProviders: true, deployEnv: 'local', r2Prefix: '' } as const

describe('createContainer', () => {
  it('tags every log line of the request with its correlation id', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { logger } = createContainer({ config, correlationId: 'ray-9', readSettings: async () => LAUNCH_SETTINGS })
    logger.info('hello')
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({ msg: 'hello', correlationId: 'ray-9' })
    log.mockRestore()
  })

  it('reads the settings with the logger of the request', async () => {
    const readSettings = vi.fn(async () => LAUNCH_SETTINGS)
    const { settings, logger } = createContainer({ config, correlationId: 'ray-9', readSettings })
    expect(await settings()).toBe(LAUNCH_SETTINGS)
    expect(readSettings).toHaveBeenCalledWith(logger)
  })
})
