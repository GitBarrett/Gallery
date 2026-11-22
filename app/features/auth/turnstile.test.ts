import { describe, expect, it, vi } from 'vitest'
import { loadTurnstile } from './turnstile'

describe('loadTurnstile', () => {
  it('adds the explicit-render script once, retried after a failure', async () => {
    const added: HTMLScriptElement[] = []
    vi.spyOn(document.head, 'append').mockImplementation((node) => void added.push(node as HTMLScriptElement))

    const failing = loadTurnstile()
    expect(loadTurnstile()).toBe(failing)
    expect(added).toHaveLength(1)
    expect(added[0]!.src).toContain('challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
    added[0]!.onerror!(new Event('error'))
    await expect(failing).rejects.toThrow('Turnstile unavailable')

    const api = { render: () => 'id' }
    ;(window as unknown as { turnstile: unknown }).turnstile = api
    const loading = loadTurnstile()
    expect(added).toHaveLength(2)
    added[1]!.onload!(new Event('load'))
    await expect(loading).resolves.toBe(api)
  })
})
