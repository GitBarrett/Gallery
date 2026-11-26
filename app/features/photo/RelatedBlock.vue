<script setup lang="ts">
// « More from » of the photo page (US-70.1, US-70.2, Photo mockup: 2 × 2 thumbnails): a section per kind given by the
// server — the author's, then similar captures; or the same zone; or the latest of the version — never empty.
import type { PhotoResponse, RelatedResponse } from '~~/shared/contracts/photos'

const props = defineProps<{ sections: RelatedResponse['sections']; photo: PhotoResponse }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const named = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
const heading = (kind: RelatedResponse['sections'][number]['kind']) => {
  if (kind === 'author') return t('photo.related.author', { author: props.photo.author.username })
  if (kind === 'similar') return t('photo.related.similar')
  if (kind === 'zone' && props.photo.zone) return t('photo.related.zone', { zone: named(props.photo.zone) })
  return t('photo.related.latest', { version: named(props.photo.version) })
}
</script>

<template>
  <section v-for="section in sections" :key="section.kind" class="related" :aria-label="heading(section.kind)">
    <h2 class="title">{{ heading(section.kind) }}</h2>
    <ul class="thumbs">
      <li v-for="capture in section.items" :key="capture.id">
        <NuxtLink :to="localePath(`/p/${capture.id}`)" class="thumb" :class="capture.quality">
          <UiWowImage
            :photo-id="capture.id"
            :alt="t('captures.alt', { title: capture.title, author: capture.author.username })"
            :width="capture.width"
            :height="capture.height"
            sizes="160px"
            class="image"
          />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.related {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.thumb {
  display: block;
  overflow: hidden;
  border: 2px solid var(--quality-poor);
  border-radius: var(--radius-md);
  aspect-ratio: 1;
}

.thumb:focus-visible {
  box-shadow: var(--focus-ring);
}

.thumb.uncommon {
  border-color: var(--quality-uncommon);
}

.thumb.rare {
  border-color: var(--quality-rare);
}

.thumb.epic {
  border-color: var(--quality-epic);
}

.thumb.legendary {
  border-color: var(--quality-legendary);
}

/* Square thumbnails: more specific than the `height: auto` of UiWowImage */
.thumb .image {
  height: 100%;
  object-fit: cover;
}
</style>
