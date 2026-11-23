import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody, setResponseStatus } from 'h3'
import SocialLinksForm from './SocialLinksForm.vue'

const sent = vi.fn()
registerEndpoint('/api/me/social-links', {
  method: 'GET',
  handler: () => ({ links: [{ platform: 'x', handle: 'ash' }] }),
})
registerEndpoint('/api/me/social-links', {
  method: 'PUT',
  handler: async (event) => {
    const body = await readBody(event)
    sent(body)
    if (body.links.some((l: { handle: string }) => l.handle === 'luneblade_bastard')) {
      setResponseStatus(event, 400)
      return {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'x',
          details: { field: 'twitch', reason: 'insult' },
          correlationId: 'c',
        },
      }
    }
    return null
  },
})

const mount = () => mountSuspended(SocialLinksForm, { props: { username: 'Ash_Barrett' } })
const field = (wrapper: Awaited<ReturnType<typeof mount>>, label: string) =>
  wrapper.get(
    `#${wrapper
      .findAll('label')
      .find((l) => l.text() === label)!
      .attributes('for')}`,
  )

describe('SocialLinksForm', () => {
  it('US-82.1 shows the stored identifiers, saves the filled fields only, an emptied one removed', async () => {
    const wrapper = await mount()
    await vi.waitFor(() => expect((field(wrapper, 'X').element as HTMLInputElement).value).toBe('ash'))
    await field(wrapper, 'X').setValue('')
    await field(wrapper, 'Twitch').setValue(' luneblade ')
    await field(wrapper, 'Website').setValue('https://ash.example.com')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Social networks saved.'))
    expect(sent).toHaveBeenLastCalledWith({
      links: [
        { platform: 'twitch', handle: 'luneblade' },
        { platform: 'website', handle: 'https://ash.example.com' },
      ],
    })
  })

  it('US-82.2 US-82.3 shows the problem under its field before sending, and the server refusal too', async () => {
    sent.mockClear()
    const wrapper = await mount()
    await field(wrapper, 'Twitch').setValue('https://twitch.tv/luneblade')
    await field(wrapper, 'Website').setValue('http://ash.example.com')
    expect(wrapper.text()).toContain('This is not a valid Twitch username.')
    expect(wrapper.text()).toContain('Enter an https:// address')
    await wrapper.get('form').trigger('submit')
    expect(sent).not.toHaveBeenCalled()

    await field(wrapper, 'Website').setValue('')
    await field(wrapper, 'Twitch').setValue('luneblade_bastard') // the fake server refuses it as an insult
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('This contains a word that is not allowed.'))
  })
})
