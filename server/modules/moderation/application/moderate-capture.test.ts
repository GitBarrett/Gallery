import { describe, expect, it, vi } from 'vitest'
import { inMemoryModerationDecisions } from '../../../../tests/fakes/in-memory-moderation-decisions'
import { moderateCapture, PROVIDER_ATTEMPTS } from './moderate-capture'
import type { ModerationProvider } from './ports'

const image = new Uint8Array([0xff, 0xd8, 0xff])
const photoId = '0193a000-0000-7000-8000-000000000001'
// Scores by title, like the fake of the previews (infrastructure, out of reach of the application layer)
const SCORES: Record<string, number> = { Fixture_nsfw: 0.95, Fixture_review: 0.6 }
const fakeModerationProvider = (): ModerationProvider => ({
  async check(_image, { title }) {
    if (title === 'Fixture_down') throw new Error('provider down')
    const score = SCORES[title ?? ''] ?? 0.02
    return { score, raw: { fake: true, score } }
  },
})

function setup(provider: ModerationProvider = fakeModerationProvider(), thresholds = { review: 0.5, reject: 0.85 }) {
  const decisions = inMemoryModerationDecisions()
  const sleep = vi.fn(async () => {})
  const run = moderateCapture({
    provider,
    decisions: decisions.repo,
    thresholds: async () => thresholds,
    sleep,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  })
  return { ...decisions, sleep, run }
}

describe('moderateCapture', () => {
  it('US-50.1 US-50.2 US-50.3 decides from the max score against the thresholds', async () => {
    const { run } = setup()
    expect(await run({ photoId, title: 'Fixture_nsfw', image })).toEqual({ outcome: 'rejected', score: 0.95 })
    expect(await run({ photoId, title: 'Fixture_review', image })).toEqual({ outcome: 'pending_review', score: 0.6 })
    expect(await run({ photoId, title: 'Dawn on the Plains', image })).toEqual({ outcome: 'published', score: 0.02 })
  })

  it('US-50.4 sends to review after 3 failed calls, with an exponential backoff', async () => {
    const { run, sleep, rows } = setup()
    expect(await run({ photoId, title: 'Fixture_down', image })).toEqual({ outcome: 'pending_review', score: null })
    expect(sleep.mock.calls).toEqual([[1000], [2000]])
    expect(rows).toEqual([
      { targetId: photoId, decision: 'pending_review', scores: null, reason: 'provider_unavailable' },
    ])
  })

  it('US-50.4 decides with the call that answers after a failure', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ score: 0.9, raw: { a: 1 } })
    const { run } = setup({ check })
    expect(await run({ photoId, title: null, image })).toEqual({ outcome: 'rejected', score: 0.9 })
    expect(check).toHaveBeenCalledTimes(2)
    expect(check).toHaveBeenCalledWith(image, { title: null })
    expect(PROVIDER_ATTEMPTS).toBe(3)
  })

  it('US-50.5 applies the thresholds of the moment', async () => {
    const { run } = setup(fakeModerationProvider(), { review: 0.7, reject: 0.9 })
    expect((await run({ photoId, title: 'Fixture_review', image })).outcome).toBe('published')
  })

  it('US-50.6 records each automatic decision with its raw scores, one per capture: a replay keeps the latest', async () => {
    const { run, rows } = setup()
    await run({ photoId, title: 'Fixture_down', image }) // then the status write fails: the message comes again
    await run({ photoId, title: 'Fixture_nsfw', image })
    expect(rows).toEqual([
      { targetId: photoId, decision: 'rejected', scores: { fake: true, score: 0.95 }, reason: null },
    ])
  })
})
