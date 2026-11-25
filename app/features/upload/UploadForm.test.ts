import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { ApiError } from '~/services/api'
import UploadForm from './UploadForm.vue'

const send = vi.fn()
const inspect = vi.fn()
vi.mock('./useUpload', () => ({
  inspectFile: (file: File) => inspect(file),
  useUpload: () => ({ progress: ref(0), send }),
}))

registerEndpoint('/api/game-versions', () => ({
  versions: [{ slug: 'wow-forever', nameEn: 'WoW Forever', nameFr: 'WoW Forever' }],
}))
registerEndpoint('/api/zones/suggest', () => ({
  zones: [{ slug: 'stormwind', nameEn: 'Stormwind City', nameFr: 'Hurlevent' }],
}))
registerEndpoint('/api/tags/suggest', () => ({ tags: ['night'] }))

const file = new File([new Uint8Array(10)], 'dusk.jpg', { type: 'image/jpeg' })
const chosen = { ok: true, value: { file, width: 3840, height: 2160, preview: 'blob:dusk' } }

async function mounted() {
  const wrapper = await mountSuspended(UploadForm)
  await vi.waitFor(() => expect(wrapper.findAll('option')).toHaveLength(2))
  return wrapper
}

// The field of a label, as a member finds it
const field = (wrapper: Awaited<ReturnType<typeof mounted>>, label: string) =>
  wrapper.get(
    '#' +
      wrapper
        .findAll('label')
        .find((l) => l.text().startsWith(label))!
        .attributes('for'),
  )

async function fill(wrapper: Awaited<ReturnType<typeof mounted>>, zone = '') {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await vi.waitFor(() => expect(wrapper.text()).toContain('dusk.jpg'))
  await field(wrapper, 'Title').setValue('Dusk over Elwynn')
  await wrapper.get('select').setValue('wow-forever')
  if (zone) {
    await field(wrapper, 'Zone').setValue(zone)
    await new Promise((resolve) => setTimeout(resolve, 300)) // suggestions after the pause
  }
  await wrapper.get('input[type="checkbox"]').setValue(true)
}

beforeEach(() => {
  send.mockReset()
  inspect.mockReset().mockResolvedValue(chosen)
})

describe('UploadForm', () => {
  it('US-10.10 a conversion that ran out of memory says to convert on a computer, the form still usable', async () => {
    inspect.mockResolvedValue({ ok: false, error: 'memory' })
    const wrapper = await mounted()
    const input = wrapper.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Convert this file on a computer'))
    expect(input.attributes('disabled')).toBeUndefined() // another file can be chosen
  })

  it('US-10.9 tells the format a file was converted to, and warns only for the JPEG', async () => {
    const converted = (encoding: string) => ({ ok: true, value: { ...chosen.value, converted: encoding } })
    inspect.mockResolvedValueOnce(converted('webp')).mockResolvedValueOnce(converted('jpeg'))
    const wrapper = await mounted()
    const input = wrapper.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('converted to lossless WebP'))
    expect(wrapper.text()).not.toContain('loses a little detail')
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Converted to JPEG (quality 95)'))
    expect(wrapper.get('[role="alert"]').text()).toContain('loses a little detail')
  })

  it('US-10.2 refuses a file out of the rules in the browser, with its reason', async () => {
    inspect.mockResolvedValue({ ok: false, error: 'dimensions' })
    const wrapper = await mounted()
    const input = wrapper.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('between 640 and 7680 px'))
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('US-10.1 US-11.1 US-11.3 sends the file with its details, a zone out of the list as a free zone', async () => {
    send.mockResolvedValue('0193a000-0000-7000-8000-0000000000aa')
    const wrapper = await mounted()
    await fill(wrapper, 'Hidden Glade')
    const tag = wrapper.get('input[placeholder="Add a tag"]')
    await tag.setValue('Nuit Étoilée')
    await tag.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('#nuit etoilee')
    expect(wrapper.text()).toContain('✓ 3840 × 2160, within 640–7680 px')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(true))
    expect(send).toHaveBeenCalledWith(chosen.value, {
      title: 'Dusk over Elwynn',
      gameVersion: 'wow-forever',
      zoneCustom: 'Hidden Glade',
      tags: ['nuit etoilee'],
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Quest accepted.')
    expect(await axeViolations(wrapper.element)).toEqual([])
  })

  it('US-11.2 sends the zone of the dictionary when its name is chosen, in English or French', async () => {
    send.mockResolvedValue('0193a000-0000-7000-8000-0000000000aa')
    const wrapper = await mounted()
    await fill(wrapper, 'Hurlevent')
    expect(wrapper.findAll('datalist option').map((o) => o.attributes('value'))).toContain('Stormwind City')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    expect(send.mock.calls[0]![1]).toMatchObject({ zone: 'stormwind' })
    expect(send.mock.calls[0]![1].zoneCustom).toBeUndefined()
  })

  it('US-10.5 tells when the next upload is possible after the 20th of the day', async () => {
    send.mockRejectedValue(new ApiError('RATE_LIMITED', 429, 'c', { retryAfterSeconds: 3600 }))
    const wrapper = await mounted()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('20 uploads for today'))
  })

  it('US-11.5 shows the field the server refused, an insult in the title', async () => {
    send.mockRejectedValue(new ApiError('VALIDATION_FAILED', 400, 'c', { field: 'title', reason: 'insult' }))
    const wrapper = await mounted()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('a word that is not allowed'))
    expect(field(wrapper, 'Title').attributes('aria-invalid')).toBe('true')
  })

  it('US-11.1 refuses a tag out of the rules and an 11th one, and removes a tag', async () => {
    const wrapper = await mounted()
    const tag = wrapper.get('input[placeholder="Add a tag"]')
    await tag.setValue('#night')
    await tag.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('Letters, digits, spaces and hyphens only.')
    for (let i = 0; i < 11; i++) {
      await tag.setValue(`tag ${i}`)
      await tag.trigger('keydown', { key: ',' })
    }
    expect(wrapper.findAll('.chip')).toHaveLength(10)
    expect(wrapper.text()).toContain('Up to 10 tags.')
    await wrapper.get('button[aria-label="Remove the tag tag 0"]').trigger('click')
    expect(wrapper.findAll('.chip')).toHaveLength(9)
  })
})
