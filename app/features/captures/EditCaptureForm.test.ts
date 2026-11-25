import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody, setResponseStatus } from 'h3'
import { axeViolations } from '../../../tests/axe'
import EditCaptureForm from './EditCaptureForm.vue'

const ID = '0193a000-0000-7000-8000-0000000000aa'
const details = {
  id: ID,
  status: 'published',
  title: 'Dusk',
  width: 1920,
  height: 1080,
  description: 'Long story',
  altText: null,
  caption: 'Glow',
  zone: { slug: 'stormwind', nameEn: 'Stormwind City', nameFr: 'Hurlevent' },
  zoneCustom: null,
  inGameTime: '06:12',
  graphicsSettings: null,
  characterName: 'Lunelame',
  tags: ['aube'],
  focalX: 0.25,
  focalY: 0.5,
}
const sent: unknown[] = []
let refuse = false
registerEndpoint(`/api/me/photos/${ID}`, () => details)
registerEndpoint(`/api/photos/${ID}`, {
  method: 'PATCH',
  handler: async (event) => {
    sent.push(await readBody(event))
    if (!refuse) return null
    setResponseStatus(event, 400)
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'x',
        details: { field: 'caption', reason: 'insult' },
        correlationId: 'c',
      },
    }
  },
})
const field = (wrapper: Awaited<ReturnType<typeof mountSuspended<typeof EditCaptureForm>>>, label: string) =>
  wrapper.get(
    `#${wrapper
      .findAll('label')
      .find((l) => l.text().startsWith(label))!
      .attributes('for')}`,
  )

async function mounted() {
  const wrapper = await mountSuspended(EditCaptureForm, { props: { photoId: ID } })
  await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  return wrapper
}

describe('EditCaptureForm', () => {
  it('US-12.1 US-13.1 fills the form with the details, then sends them all, emptied fields cleared', async () => {
    sent.length = 0
    const wrapper = await mounted()
    expect((field(wrapper, 'Title').element as HTMLInputElement).value).toBe('Dusk')
    expect((field(wrapper, 'Zone').element as HTMLInputElement).value).toBe('Stormwind City')
    expect(wrapper.text()).toContain('#aube')
    expect(wrapper.get('.marker').attributes('style')).toContain('left: 25%') // the focal point kept
    await field(wrapper, 'Title').setValue('Dawn')
    await field(wrapper, 'Description').setValue('')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(true))
    expect(sent[0]).toMatchObject({
      title: 'Dawn',
      zone: 'stormwind', // the current zone, read back by its name
      description: '',
      caption: 'Glow',
      tags: ['aube'],
      focalX: 0.25,
      focalY: 0.5,
    })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })

  it('US-12.1 clears the zone when emptied, and shows the field the server refused', async () => {
    sent.length = 0
    refuse = true
    const wrapper = await mounted()
    await field(wrapper, 'Zone').setValue('')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('a word that is not allowed'))
    expect(sent[0]).toMatchObject({ zone: null })
    expect(field(wrapper, 'Caption').attributes('aria-invalid')).toBe('true')
    refuse = false
  })
})
