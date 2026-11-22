import { describe, expect, it, vi } from 'vitest'
import type { Clock } from '../../../platform/clock'
import type { Logger } from '../../../platform/logger'
import { LAUNCH_SETTINGS } from '../domain/settings'
import { settingsReader, type SettingRow } from './read-settings'

function setup(rows: SettingRow[]) {
  let now = Date.parse('2026-11-22T12:00:00Z')
  const clock: Clock = { now: () => new Date(now) }
  const repository = { all: vi.fn(async () => rows) }
  const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const read = settingsReader({ repository, clock })
  return { read: () => read(logger), repository, logger, advance: (ms: number) => (now += ms) }
}

describe('settings reader', () => {
  it('uses the launch values for keys without a row', async () => {
    expect(await setup([]).read()).toEqual(LAUNCH_SETTINGS)
  })

  it('US-56.1 applies a stored value, read again after at most 60 s without redeploying', async () => {
    const rows: SettingRow[] = [{ key: 'features.inviteOnly', value: false }]
    const { read, repository, advance } = setup(rows)
    expect((await read())['features.inviteOnly']).toBe(false)

    rows[0] = { key: 'features.inviteOnly', value: true }
    advance(59_000)
    expect((await read())['features.inviteOnly']).toBe(false) // cached
    advance(1_000)
    expect((await read())['features.inviteOnly']).toBe(true)
    expect(repository.all).toHaveBeenCalledTimes(2)
  })

  it('US-71.5 new quality thresholds are served once the cache expires', async () => {
    const rows: SettingRow[] = []
    const { read, advance } = setup(rows)
    await read()
    rows.push({ key: 'quality.thresholds', value: { uncommon: 10, rare: 100, epic: 500, legendary: 1000 } })
    advance(60_000)
    expect((await read())['quality.thresholds']).toEqual({ uncommon: 10, rare: 100, epic: 500, legendary: 1000 })
  })

  it('keeps the launch value of an invalid or unknown row and logs it, without its value', async () => {
    const { read, logger } = setup([
      { key: 'moderation.reportsToHide', value: -1 },
      { key: 'legal', value: { termsVersion: 1 } },
    ])
    expect((await read())['moderation.reportsToHide']).toBe(3)
    expect(logger.warn).toHaveBeenCalledWith('invalid site setting ignored', {
      key: 'moderation.reportsToHide',
      problem: 'invalid_value',
    })
    expect(logger.warn).toHaveBeenCalledTimes(1) // keys owned by later tasks (legal, T-70) are ignored silently
  })
})
