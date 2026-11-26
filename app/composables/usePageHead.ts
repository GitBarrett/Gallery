/**
 * Canonical URL of a page and its versions in both languages (US-25, 03 § SEO): hreflang en / fr / x-default. `path`
 * is the path without locale prefix, its query included only when it names the page (`/search?q=…`).
 */
export function useCanonical(path: () => string) {
  const localePath = useLocalePath()
  const origin = useRequestURL().origin
  const url = (code?: 'en' | 'fr') => `${origin}${localePath(path(), code)}`
  useHead({
    link: [
      { rel: 'canonical', href: () => url() },
      { rel: 'alternate', hreflang: 'en', href: () => url('en') },
      { rel: 'alternate', hreflang: 'fr', href: () => url('fr') },
      { rel: 'alternate', hreflang: 'x-default', href: () => url('en') },
    ],
  })
  return { url }
}

/** Head of a public page (US-25): title, description, their Open Graph twins, canonical URL and hreflang. */
export function usePageHead(head: { title: () => string; description: () => string; path: () => string }) {
  const { url } = useCanonical(head.path)
  useSeoMeta({
    title: head.title,
    description: head.description,
    ogType: 'website',
    ogTitle: head.title,
    ogDescription: head.description,
    ogUrl: () => url(),
  })
}
