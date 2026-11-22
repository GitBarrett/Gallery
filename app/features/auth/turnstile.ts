// Cloudflare Turnstile client API (explicit rendering), loaded once per page, only by the forms that need it.
// Allowed by the CSP: the app's nonced bundle adds the script ('strict-dynamic'), frame-src challenges.cloudflare.com.
export interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

let loading: Promise<Turnstile> | undefined

export function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve((window as unknown as { turnstile: Turnstile }).turnstile)
    script.onerror = () => {
      loading = undefined // a later form may try again
      reject(new Error('Turnstile unavailable'))
    }
    document.head.append(script)
  })
  return loading
}
