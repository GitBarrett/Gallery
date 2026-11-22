import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../../../platform/logger'
import { hibpBreachChecker } from './hibp-breach-checker'

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const RANGE =
  '003D68EB55068C33ACE09247EE4C639306B:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD9:0'

function fakeFetch(response: () => Response) {
  return vi.fn(async (_url: string, _init?: RequestInit) => response())
}

const logger = createLogger({ correlationId: 'test' }, () => {})

describe('hibpBreachChecker', () => {
  it('US-01.3 sends only the first 5 characters of the SHA-1, with padding', async () => {
    const fetch = fakeFetch(() => new Response(RANGE))
    await hibpBreachChecker({ fetch, logger }).isBreached('password')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.pwnedpasswords.com/range/5BAA6',
      expect.objectContaining({ headers: { 'Add-Padding': 'true' } }),
    )
  })

  it('US-01.3 finds a breached password', async () => {
    expect(
      await hibpBreachChecker({ fetch: fakeFetch(() => new Response(RANGE)), logger }).isBreached('password'),
    ).toBe(true)
  })

  it('US-01.3 ignores padding lines (count 0) and other suffixes', async () => {
    const range = '1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\n003D68EB55068C33ACE09247EE4C639306B:3'
    expect(
      await hibpBreachChecker({ fetch: fakeFetch(() => new Response(range)), logger }).isBreached('password'),
    ).toBe(false)
  })

  it.each([
    ['an error status', () => new Response('', { status: 503 })],
    [
      'a network failure',
      () => {
        throw new TypeError('fetch failed')
      },
    ],
  ])('lets the password through on %s, with a warning', async (_, response) => {
    const warn = vi.spyOn(logger, 'warn')
    expect(await hibpBreachChecker({ fetch: fakeFetch(response), logger }).isBreached('password')).toBe(false)
    expect(warn).toHaveBeenCalledWith('breach check unavailable, password accepted', expect.any(Object))
  })
})
