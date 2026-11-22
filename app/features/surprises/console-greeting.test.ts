import { describe, expect, it, vi } from 'vitest'
import { greetOnce } from './console-greeting'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v) }
}

describe('console greeting', () => {
  it('US-79.2 prints the ASCII logo and the bug report line once per session', () => {
    const storage = memoryStorage()
    const log = vi.fn()
    greetOnce({ storage: () => storage, log, line: 'Looking for guild? Report bugs: https://legendary.test/feedback' })
    greetOnce({ storage: () => storage, log, line: 'Looking for guild? Report bugs: https://legendary.test/feedback' })
    expect(log).toHaveBeenCalledTimes(1)
    const [message] = log.mock.calls[0]!
    expect(message).toContain('Looking for guild? Report bugs: https://legendary.test/feedback')
    expect(message.split('\n').length).toBeGreaterThan(3) // the ASCII logo comes first
  })

  it('still greets when session storage is unavailable (private mode), without throwing', () => {
    const log = vi.fn()
    const storage = () => ({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => greetOnce({ storage, log, line: 'x' })).not.toThrow()
    expect(log).toHaveBeenCalledTimes(1)
  })
})
