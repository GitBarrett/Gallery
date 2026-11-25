import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import AvatarForm from './AvatarForm.vue'

const VERSION = '0193a000-0000-7000-8000-0000000000b2'
const crop = vi.fn()
const put = vi.fn()
vi.mock('./crop-square', () => ({ cropSquare: (file: File) => crop(file) }))
vi.mock('~/features/upload/useUpload', () => ({ put: (...args: unknown[]) => put(...args) }))

const asked = vi.fn()
const completed = vi.fn()
registerEndpoint('/api/me/avatar-upload-url', {
  method: 'POST',
  handler: async (event) => {
    asked(await readBody(event))
    return { version: VERSION, url: 'https://r2.example.com/put', expiresAt: '2026-11-25T10:10:00.000Z' }
  },
})
registerEndpoint('/api/me/avatar/complete', {
  method: 'POST',
  handler: async (event) => {
    completed(await readBody(event))
    return null
  },
})

const square = new File([new Uint8Array(100)], 'avatar.jpg', { type: 'image/jpeg' })
URL.createObjectURL = () => 'blob:avatar'
URL.revokeObjectURL = () => {}

async function choose(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'me.png', { type: 'image/png' })] })
  await input.trigger('change')
  await vi.waitFor(() => expect(crop).toHaveBeenCalled())
  await nextTick()
}

beforeEach(() => vi.clearAllMocks())

describe('AvatarForm', () => {
  it('US-07.6 shows the centred square, sends it and says it is being checked', async () => {
    crop.mockResolvedValue({ file: square, side: 512 })
    put.mockResolvedValue(200)
    const wrapper = await mountSuspended(AvatarForm, { props: { avatarUrl: null, username: 'Ash' } })
    await choose(wrapper)
    expect(wrapper.get('img').attributes('src')).toBe('blob:avatar')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(true))
    expect(asked).toHaveBeenCalledWith({ contentType: 'image/jpeg', bytes: 100, width: 512, height: 512 })
    expect(put).toHaveBeenCalledWith('https://r2.example.com/put', square, expect.any(Function))
    expect(completed).toHaveBeenCalledWith({ version: VERSION })
    expect(wrapper.get('[role="status"]').text()).toContain('being checked')
    expect(wrapper.text()).toContain('A') // the avatar shown stays until approved
  })

  it('US-07.6 refuses an image under 128 px or unreadable, and says when the upload failed', async () => {
    crop.mockResolvedValue({ file: square, side: 100 })
    const small = await mountSuspended(AvatarForm, { props: { avatarUrl: null, username: 'Ash' } })
    await choose(small)
    expect(small.get('[role="alert"]').text()).toContain('128 × 128')
    expect(small.find('button').exists()).toBe(false)

    crop.mockResolvedValue(null)
    const unreadable = await mountSuspended(AvatarForm, { props: { avatarUrl: null, username: 'Ash' } })
    await choose(unreadable)
    expect(unreadable.get('[role="alert"]').text()).toContain('cannot be read')

    crop.mockResolvedValue({ file: square, side: 512 })
    put.mockResolvedValue(0)
    const failed = await mountSuspended(AvatarForm, { props: { avatarUrl: null, username: 'Ash' } })
    await choose(failed)
    await failed.get('button').trigger('click')
    await vi.waitFor(() => expect(failed.find('[role="alert"]').exists()).toBe(true))
    expect(failed.get('[role="alert"]').text()).toContain('could not be sent')
    expect(completed).not.toHaveBeenCalled()
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(AvatarForm, { props: { avatarUrl: null, username: 'Ash' } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
