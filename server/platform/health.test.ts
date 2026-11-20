import { describe, expect, it } from 'vitest'
import { databaseCheck, r2Check, runHealthChecks } from './health'

describe('runHealthChecks', () => {
  it('reports ok when every check passes', async () => {
    expect(await runHealthChecks({ database: async () => {}, r2: async () => {} })).toEqual({
      status: 'ok',
      checks: { database: 'ok', r2: 'ok' },
    })
  })

  it('reports fail and still runs the other checks when one throws', async () => {
    let r2Ran = false
    const result = await runHealthChecks({
      database: async () => {
        throw new Error('connection refused')
      },
      r2: async () => {
        r2Ran = true
      },
    })
    expect(result).toEqual({ status: 'fail', checks: { database: 'fail', r2: 'ok' } })
    expect(r2Ran).toBe(true)
  })

  it('reports ok with no checks (local development without bindings)', async () => {
    expect(await runHealthChecks({})).toEqual({ status: 'ok', checks: {} })
  })
})

describe('checks', () => {
  it('database check runs a trivial query', async () => {
    const queries: string[] = []
    await databaseCheck(async (strings) => queries.push(strings.join('?')))()
    expect(queries).toEqual(['select 1'])
  })

  it('R2 check reads object metadata without downloading anything', async () => {
    const keys: string[] = []
    await r2Check({ head: async (key) => keys.push(key) })()
    expect(keys).toEqual(['health'])
  })
})
