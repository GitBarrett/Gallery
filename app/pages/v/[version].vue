<script setup lang="ts">
// PLP /v/{version} (US-20, Category mockup): the published captures of a game version, newest first, rendered by the
// server. An unknown or archived version is the 404 page (US-20.4); a version without capture invites to upload
// (US-70.5). The filters come with T-30c; the counts of the banner and the popular tags of the mockup are left out (Q83).
import GalleryGrid from '~/features/gallery/GalleryGrid.vue'
import { useGalleryFeed } from '~/features/gallery/useGalleryFeed'
import { useGameVersions } from '~/features/gallery/useGameVersions'

// A new instance per version: the version read once below must follow a client navigation between versions
definePageMeta({ key: (route) => route.path })
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const slug = String(route.params.version)
const versions = await useGameVersions()
const nameOf = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
const current = versions.value.find((v) => v.slug === slug)
const feed = await useGalleryFeed(slug)
if (!current || !feed.found.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
if (feed.failed.value) throw createError({ statusCode: 500, statusMessage: 'Gallery unavailable', fatal: true })
const name = computed(() => nameOf(current))
useHead({
  title: () => t('gallery.title', { version: name.value }),
  meta: [{ name: 'description', content: () => t('gallery.description', { version: name.value }) }],
})
</script>

<template>
  <div class="plp">
    <section class="banner" aria-labelledby="plp-title">
      <nav :aria-label="t('gallery.breadcrumb')" class="breadcrumb">
        <NuxtLink :to="localePath('/')">{{ t('gallery.home') }}</NuxtLink>
        <span aria-hidden="true"> / </span>
        <span>{{ t('gallery.versions') }}</span>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{{ name }}</span>
      </nav>
      <h1 id="plp-title" class="title">{{ name }}</h1>
      <nav :aria-label="t('gallery.versions')">
        <ul class="versions">
          <li v-for="v in versions" :key="v.slug">
            <NuxtLink
              :to="localePath(`/v/${v.slug}`)"
              class="version"
              :aria-current="v.slug === slug ? 'page' : undefined"
            >
              {{ nameOf(v) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </section>
    <GalleryGrid
      v-if="feed.captures.value.length"
      :captures="feed.captures.value"
      :label="t('gallery.title', { version: name })"
      :done="feed.done.value"
      :loading="feed.loading.value"
      :error="feed.error.value && t(feed.error.value)"
      @more="feed.loadMore"
    />
    <UiEmptyState v-else :title="t('gallery.emptyTitle', { version: name })" :description="t('gallery.emptyText')">
      <template #action>
        <UiButton :to="localePath('/upload')">{{ t('gallery.upload') }}</UiButton>
      </template>
    </UiEmptyState>
  </div>
</template>

<style scoped>
.plp {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.banner {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
}

.versions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.version {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  padding: 0 var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-text);
  text-decoration: none;
}

.version[aria-current='page'] {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
