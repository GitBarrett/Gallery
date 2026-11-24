import { describe, expect, it } from 'vitest'
import { baseJpeg } from '../../../../tests/builders/images'
import { fakeImageService } from '../../../../tests/fakes/fake-image-service'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { inMemoryObjectStorage } from '../../../../tests/fakes/in-memory-object-storage'
import type { QueueMessage } from '../../../platform/jobs'
import { photoProcessConsumer } from './photo-process-consumer'

const ID = '0193a000-0000-7000-8000-0000000000aa'

async function setup() {
  const clock = { now: () => new Date('2026-11-24T10:00:00Z') }
  const { repo, rows } = inMemoryMediaRepository(clock)
  const { storage, objects } = inMemoryObjectStorage()
  const { images, state } = fakeImageService()
  const file = baseJpeg()
  await repo.createUpload({
    id: ID,
    userId: 'u-ash',
    mime: 'image/jpeg',
    bytes: file.length,
    width: 1920,
    height: 1080,
  })
  await repo.complete(ID, { title: 'Dusk', gameVersion: 'wow-forever', at: clock.now() })
  objects.set(`incoming/${ID}`, { bytes: file.length, contentType: 'image/jpeg', data: file })
  return { deps: { repo, storage, images }, rows, objects, state }
}

describe('photo-process consumer', () => {
  const message = (attempts: number): QueueMessage => ({ id: 'm1', body: null, attempts, ack() {}, retry() {} })
  const body = { eventId: '0193a000-0000-7000-8000-0000000000ee', payload: { kind: 'capture', photoId: ID } }

  it('US-10.8 sends a transient failure back to the queue, then ends the capture failed at the 4th attempt', async () => {
    const s = await setup()
    const consume = photoProcessConsumer(s.deps)
    s.state.failing = true
    for (const attempt of [1, 2, 3]) {
      await expect(consume(body, message(attempt))).rejects.toThrow('Images unavailable')
      expect(s.rows.get(ID)?.status).toBe('processing')
    }
    await expect(consume(body, message(4))).rejects.toThrow('Images unavailable') // then the DLQ (alert)
    expect(s.rows.get(ID)?.status).toBe('failed')
    expect([...s.objects.keys()]).toEqual([])
  })

  it('US-14.2 processes the capture of the message, and refuses a message of another shape', async () => {
    const s = await setup()
    const consume = photoProcessConsumer(s.deps)
    await consume(body, message(1))
    expect(s.rows.get(ID)?.status).toBe('pending_review')
    await expect(consume({ ...body, payload: { kind: 'avatar', photoId: ID } }, message(1))).rejects.toThrow()
  })
})
