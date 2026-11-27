<script setup lang="ts">
// Photo page /p/{id} (US-25.1, Photo mockup), rendered by the server: the image, its quality badge (US-71.2), its
// details as an item of the game, the author and the tags, the previous / next captures of the version (buttons,
// swipe, arrow keys: US-67.2) and the « More from » block (US-70.1, US-70.2); Open Graph, Twitter Card, canonical,
// hreflang and ImageObject for robots. A capture that is not public is the 404 page. The actions (the like,
// US-30, and the download, US-23), sticky at the bottom below 768 px (07 § Responsive); share and comments come with their tasks
// (T-40, T-42, T-41).
import DownloadButton from '~/features/photo/DownloadButton.vue'
import LikeButton from '~/features/photo/LikeButton.vue'
import PhotoDetails from '~/features/photo/PhotoDetails.vue'
import PhotoNav from '~/features/photo/PhotoNav.vue'
import QualityBadgeTip from '~/features/photo/QualityBadgeTip.vue'
import RelatedBlock from '~/features/photo/RelatedBlock.vue'
import { usePhoto } from '~/features/photo/usePhoto'
import { usePhotoHead } from '~/features/photo/usePhotoHead'
import { usePhotoNavigation } from '~/features/photo/usePhotoNavigation'
import { useRelated } from '~/features/photo/useRelated'
import type { PhotoResponse } from '~~/shared/contracts/photos'

definePageMeta({ key: (route) => route.path })
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const id = String(route.params.id)
const [found, related] = await Promise.all([usePhoto(id), useRelated(id)])
if (!found.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const photo = computed(() => found.value as PhotoResponse)
const alt = usePhotoHead(photo)
const figure = ref<HTMLElement>()
usePhotoNavigation(figure, related)
const version = computed(() => (locale.value === 'fr' ? photo.value.version.nameFr : photo.value.version.nameEn))
</script>

<template>
  <article class="pdp" aria-labelledby="pdp-title">
    <nav :aria-label="t('gallery.breadcrumb')" class="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ t('gallery.home') }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink :to="localePath(`/v/${photo.version.slug}`)">{{ version }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ photo.title }}</span>
    </nav>
    <div class="layout">
      <figure ref="figure" class="figure" :class="photo.quality">
        <UiWowImage
          :photo-id="photo.id"
          :alt="alt"
          :width="photo.width"
          :height="photo.height"
          priority
          sizes="(width >= 1024px) 66vw, 100vw"
        />
        <QualityBadgeTip :quality="photo.quality" :likes="photo.likes" class="badge" />
        <PhotoNav v-if="related" :prev="related.prev" :next="related.next" class="nav" />
      </figure>
      <aside class="aside">
        <h1 id="pdp-title" class="visually-hidden">{{ photo.title }}</h1>
        <div class="actions">
          <LikeButton :photo-id="photo.id" :likes="photo.likes" :author="photo.author.username" />
          <DownloadButton :photo-id="photo.id" :bytes="photo.bytes" />
        </div>
        <PhotoDetails :photo="photo" />
        <p v-if="photo.description" class="description">{{ photo.description }}</p>
        <NuxtLink :to="localePath(`/u/${photo.author.username}`)" class="author">
          <UiAvatar :src="photo.author.avatarUrl" :name="photo.author.username" />
          <span>{{ t('photo.by', { author: photo.author.username }) }}</span>
        </NuxtLink>
        <ul v-if="photo.tags.length" class="tags" :aria-label="t('photo.tags')">
          <li v-for="tag in photo.tags" :key="tag" class="tag">#{{ tag }}</li>
        </ul>
        <RelatedBlock v-if="related?.sections.length" :sections="related.sections" :photo="photo" />
      </aside>
    </div>
  </article>
</template>

<style scoped>
.pdp {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

/* US-67.5: a touch target of 44 px */
.breadcrumb a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-md);
  min-height: var(--control-md);
}

.layout {
  display: grid;
  gap: var(--space-6);
}

@media (width >= 1024px) {
  .layout {
    grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
    align-items: start;
  }
}

/* No overflow: hidden, which would cut the tooltip of the badge: the image takes the rounded corners itself.
   pan-y: the page still scrolls vertically, a horizontal swipe reaches usePhotoNavigation (US-67.2) */
.figure {
  position: relative;
  margin: 0;
  border: 2px solid var(--quality-poor);
  border-radius: var(--radius-md);
  touch-action: pan-y;
}

.nav {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  left: var(--space-2);
}

.figure :deep(.wow-image) {
  border-radius: calc(var(--radius-md) - 2px);
}

.figure.uncommon {
  border-color: var(--quality-uncommon);
}

.figure.rare {
  border-color: var(--quality-rare);
}

.figure.epic {
  border-color: var(--quality-epic);
}

.figure.legendary {
  border-color: var(--quality-legendary);
}

.badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.aside {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-start;
}

/* Above the tab bar on a phone, so the actions stay at hand while reading the details */
@media (width < 768px) {
  .actions {
    position: sticky;
    z-index: var(--z-dropdown);
    bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
    padding: var(--space-2) 0;
    background: var(--color-bg);
  }
}

.description {
  margin: 0;
  color: var(--color-text-soft);
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.author {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  align-self: flex-start;
  min-height: var(--control-md);
  color: var(--color-text);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tag {
  padding: var(--space-1) var(--space-2);
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-pill);
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}
</style>
