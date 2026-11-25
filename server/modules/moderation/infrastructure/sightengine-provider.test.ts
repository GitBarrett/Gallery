import { describe, expect, it, vi } from 'vitest'
import { moderationProviderContract } from '../../../../tests/contracts/moderation-provider.contract'
import { sightengineProvider } from './sightengine-provider'

// Answers of https://sightengine.com/docs/reference (nudity-2.1, gore-2.0, offensive-2.0), trimmed
const answer = (scores: { erotica?: number; gore?: number; middle_finger?: number } = {}) => ({
  status: 'success',
  request: { id: 'req_1', timestamp: 1764000000.1, operations: 3 },
  nudity: {
    sexual_activity: 0.01,
    sexual_display: 0.01,
    erotica: scores.erotica ?? 0.02,
    very_suggestive: 0.97, // swimwear: allowed
    suggestive: 0.9,
    mildly_suggestive: 0.5,
    suggestive_classes: { bikini: 0.9 },
    none: 0.01,
    context: { sea_lake_pool: 0.9 },
  },
  gore: { prob: scores.gore ?? 0.01, classes: { very_bloody: 0.01 }, type: { animated: 0.9 } },
  offensive: {
    nazi: 0.01,
    asian_swastika: 0.01,
    confederate: 0.01,
    supremacist: 0.01,
    terrorist: 0.01,
    middle_finger: scores.middle_finger ?? 0.01,
  },
  media: { id: 'med_1', uri: 'capture.jpg' },
})
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const provider = (body: unknown, status = 200) =>
  sightengineProvider({ apiUser: 'u', apiSecret: 's', fetch: reply(body, status) })

moderationProviderContract('Sightengine (recorded answers)', () => provider(answer()))

describe('sightengineProvider', () => {
  it('US-14.1 sends the JPEG as a file with the 3 models, and keeps the raw answer', async () => {
    const fetch = reply(answer())
    const found = await sightengineProvider({ apiUser: 'user', apiSecret: 'secret', fetch }).check(image, {
      title: 'x',
    })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.sightengine.com/1.0/check.json')
    const form = init.body as FormData
    expect(form.get('models')).toBe('nudity-2.1,gore-2.0,offensive-2.0')
    expect([form.get('api_user'), form.get('api_secret')]).toEqual(['user', 'secret'])
    expect(new Uint8Array(await (form.get('media') as Blob).arrayBuffer())).toEqual(image)
    expect(found).toEqual({ score: 0.02, raw: answer() })
  })

  it('US-50.1 scores the max of explicit nudity, gore and offensive symbols, not swimwear', async () => {
    const score = async (scores: Parameters<typeof answer>[0]) =>
      (await provider(answer(scores)).check(image, { title: null })).score
    expect(await score({ erotica: 0.91 })).toBe(0.91)
    expect(await score({ gore: 0.88 })).toBe(0.88)
    expect(await score({ middle_finger: 0.7 })).toBe(0.7)
  })

  it('US-50.4 throws on a failure, an error status or an answer outside the contract', async () => {
    const failure = {
      status: 'failure',
      error: { type: 'usage_limit', code: 32, message: 'Daily usage limit reached' },
    }
    await expect(provider(failure, 429).check(image, { title: null })).rejects.toThrow('sightengine usage_limit 32')
    await expect(provider({ status: 'success' }).check(image, { title: null })).rejects.toThrow('unexpected answer')
    await expect(provider(answer(), 500).check(image, { title: null })).rejects.toThrow('unexpected answer (500)')
    await expect(provider(answer({ gore: 7 })).check(image, { title: null })).rejects.toThrow()
    await expect(provider('<html>').check(image, { title: null })).rejects.toThrow('unexpected answer')
  })
})
