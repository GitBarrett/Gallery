import { describe, expect, it } from 'vitest'
import { inMemoryMediaRepository } from '../../../../tests/fakes/in-memory-media-repository'
import { listMyCaptures, MY_CAPTURES_PAGE } from './my-captures'

const at = new Date('2026-11-25T10:00:00Z')
const id = (n: number) => `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`

async function setup(count: number) {
  const { repo, rows } = inMemoryMediaRepository({ now: () => at })
  for (let n = 1; n <= count; n++) {
    await repo.createUpload({ id: id(n), userId: 'u-ash', mime: 'image/png', bytes: 1, width: 1920, height: 1080 })
    await repo.complete(id(n), { title: `Capture ${n}`, gameVersion: 'wow-forever', at })
  }
  return { repo, rows, list: listMyCaptures({ repo }) }
}

describe('listMyCaptures', () => {
  it('US-14.4 lists the member’s completed captures of every status, latest first, with their size', async () => {
    const { repo, rows, list } = await setup(3)
    rows.get(id(2))!.status = 'rejected'
    await repo.createUpload({ id: id(9), userId: 'u-ash', mime: 'image/png', bytes: 1, width: 1, height: 1 }) // not completed
    await repo.createUpload({ id: id(8), userId: 'u-jaina', mime: 'image/png', bytes: 1, width: 1, height: 1 })
    await repo.complete(id(8), { title: 'Theirs', gameVersion: 'wow-forever', at })
    expect(await list({ userId: 'u-ash' })).toEqual({
      items: [3, 2, 1].map((n) => ({
        id: id(n),
        title: `Capture ${n}`,
        status: n === 2 ? 'rejected' : 'processing',
        width: 1920,
        height: 1080,
        uploadedAt: at,
      })),
      nextCursor: null,
    })
  })

  it('US-14.4 pages by cursor, without gap nor repeat', async () => {
    const { list } = await setup(MY_CAPTURES_PAGE + 5)
    const first = await list({ userId: 'u-ash' })
    expect(first.items).toHaveLength(MY_CAPTURES_PAGE)
    expect(first.nextCursor).toBe(first.items.at(-1)!.id)
    const second = await list({ userId: 'u-ash', cursor: first.nextCursor! })
    expect(second).toMatchObject({ nextCursor: null })
    expect(second.items.map((c) => c.id)).toEqual([5, 4, 3, 2, 1].map(id))
  })
})
