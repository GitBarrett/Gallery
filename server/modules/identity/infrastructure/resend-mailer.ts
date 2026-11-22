import { z } from 'zod'
import type { Mailer } from '../application/ports'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const sent = z.object({ id: z.string() })

/** Resend REST API. Errors carry the status only: the provider's message may quote the recipient. */
export const resendMailer = ({ apiKey, from, fetch }: { apiKey: string; from: string; fetch: Fetch }): Mailer => ({
  async send({ to, subject, text }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Resend refused the email (status ${response.status})`)
    sent.parse(await response.json())
  },
})
