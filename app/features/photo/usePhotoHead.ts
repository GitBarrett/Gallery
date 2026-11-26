import type { PhotoResponse } from '~~/shared/contracts/photos'

/**
 * Head of the photo page for robots and link previews (US-25.1, 03 § SEO): title, description, Open Graph and Twitter
 * Card with the 1200 px JPEG (`/img/{id}/og.jpg`: not every robot reads WebP), canonical URL, hreflang en / fr /
 * x-default, and an `ImageObject` (author, date, licence = the Terms). Returns the alternative text of the image
 * (US-75.3: the author's, or « {title} — {zone}, captured by {author} »).
 */
export function usePhotoHead(photo: Ref<PhotoResponse>) {
  const { t, locale } = useI18n()
  const localePath = useLocalePath()
  const origin = useRequestURL().origin
  const named = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
  const p = () => photo.value
  const author = () => p().author.username
  const alt = computed(() => {
    if (p().altText) return p().altText!
    const zone = p().zone
    return zone
      ? t('photo.alt', { title: p().title, zone: named(zone), author: author() })
      : t('captures.alt', { title: p().title, author: author() })
  })
  const path = (code: 'en' | 'fr') => `${origin}${localePath(`/p/${p().id}`, code)}`
  const url = () => `${origin}${localePath(`/p/${p().id}`)}`
  const image = () => `${origin}/img/${p().id}/og.jpg`
  const title = () => t('photo.title', { title: p().title, version: named(p().version) })
  const description = () =>
    p().description ??
    p().caption ??
    t('photo.description', { title: p().title, version: named(p().version), author: author() })

  useSeoMeta({
    title,
    description,
    ogType: 'article',
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    ogImage: image,
    ogImageAlt: () => alt.value,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  })
  // `<` escaped: author text inside a script element must never close it
  const imageObject = () =>
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name: p().title,
      description: description(),
      contentUrl: `${origin}/img/${p().id}/1200`,
      thumbnailUrl: image(),
      width: p().width,
      height: p().height,
      datePublished: p().publishedAt,
      creator: { '@type': 'Person', name: author(), url: `${origin}${localePath(`/u/${author()}`)}` },
      license: `${origin}${localePath('/terms')}`,
    }).replace(/</g, '\\u003c')
  useHead({
    link: [
      { rel: 'canonical', href: url },
      { rel: 'alternate', hreflang: 'en', href: () => path('en') },
      { rel: 'alternate', hreflang: 'fr', href: () => path('fr') },
      { rel: 'alternate', hreflang: 'x-default', href: () => path('en') },
    ],
    script: [{ type: 'application/ld+json', innerHTML: imageObject }],
  })
  return alt
}
