import { expect, it } from 'vitest'
import { mailerContract } from '../../../../tests/contracts/mailer.contract'
import { recordingMailer } from '../../../../tests/fakes/recording-mailer'
import type { EmailMessage } from '../application/ports'
import { resendMailer } from './resend-mailer'

const FROM = 'Legendary Shots <noreply@mail.legendaryshots.gg>'

// Resend API replaced by a fetch that checks the request like the provider would
function resendApi({ refusing }: { refusing: boolean }) {
  const delivered: EmailMessage[] = []
  const requests: { url: string; init: RequestInit }[] = []
  const fetch = async (url: string, init: RequestInit = {}) => {
    requests.push({ url, init })
    if (refusing) return Response.json({ name: 'validation_error', message: 'Invalid `to` field' }, { status: 422 })
    const body = JSON.parse(String(init.body))
    delivered.push({ to: body.to, subject: body.subject, text: body.text })
    return Response.json({ id: crypto.randomUUID() })
  }
  return { fetch, delivered, requests }
}

mailerContract('recording fake', ({ refusing }) => {
  const { mailer, sent } = recordingMailer({ refusing })
  return { mailer, delivered: () => sent }
})

mailerContract('Resend', ({ refusing }) => {
  const api = resendApi({ refusing })
  return { mailer: resendMailer({ apiKey: 're_test', from: FROM, fetch: api.fetch }), delivered: () => api.delivered }
})

it('Resend: authenticates with the key and sends from the configured sender', async () => {
  const api = resendApi({ refusing: false })
  await resendMailer({ apiKey: 're_test', from: FROM, fetch: api.fetch }).send({
    to: 'a@example.com',
    subject: 's',
    text: 't',
  })
  const [{ url, init }] = api.requests as [{ url: string; init: RequestInit }]
  expect(url).toBe('https://api.resend.com/emails')
  expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test' })
  expect(JSON.parse(String(init.body))).toMatchObject({ from: FROM })
})

it('Resend: rejects an answer without message id', async () => {
  const fetch = async () => Response.json({ unexpected: true })
  await expect(
    resendMailer({ apiKey: 're_test', from: FROM, fetch }).send({ to: 'a@example.com', subject: 's', text: 't' }),
  ).rejects.toThrow()
})
