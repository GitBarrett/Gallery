<script setup lang="ts">
// PLP /v/{version} (US-20, Category mockup): the published captures of a game version, rendered by the server, with
// their filters in the URL (US-20.3: shared links and the back button give the same grid). An unknown or archived
// version is the 404 page (US-20.4); a version without capture invites to upload (US-70.5). The counts of the banner
// and the popular tags of the mockup are left out (Q83).
import { readFilters, writeFilters, type GalleryFilters as Filters } from '~/features/gallery/filters'
import GalleryFilterFields from '~/features/gallery/GalleryFilterFields.vue'
import GalleryFilters from '~/features/gallery/GalleryFilters.vue'
import GalleryGrid from '~/features/gallery/GalleryGrid.vue'
import { useGalleryFeed } from '~/features/gallery/useGalleryFeed'
import { useGameVersions } from '~/features/gallery/useGameVersions'
import VersionNav from '~/features/gallery/VersionNav.vue'

// A new instance per version: the version read once below must follow a client navigation between versions
definePageMeta({ key: (route) => route.path })
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const slug = String(route.params.version)
const versions = await useGameVersions()
const nameOf = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
const current = versions.value.find((v) => v.slug === slug)
const filters = computed(() => readFilters(route.query))
// A sort narrows nothing: an empty version keeps its « Be the first » whatever the sort
const filtered = computed(() => Boolean(filters.value.zone || filters.value.timeOfDay || filters.value.minQuality))
const feed = await useGalleryFeed(slug, filters)
// Each change is a new entry of the history, so the back button returns to the previous filters
const change = (next: Filters) => navigateTo({ query: writeFilters(next) })
// The zone of the URL is a slug: its name is read on the captures it filters
const zoneName = computed(() => {
  const zone = feed.captures.value.find((c) => c.zone?.slug === filters.value.zone)?.zone
  return zone ? nameOf(zone) : undefined
})
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
      <VersionNav :versions="versions" :current="slug" />
    </section>
    <GalleryFilters v-slot="{ thresholds }">
      <GalleryFilterFields :filters="filters" :zone-name="zoneName" :thresholds="thresholds" @change="change" />
    </GalleryFilters>
    <p v-if="feed.failed.value" class="error" role="alert">{{ t('errors.INTERNAL') }}</p>
    <GalleryGrid
      v-else-if="feed.captures.value.length"
      :captures="feed.captures.value"
      :label="t('gallery.title', { version: name })"
      :done="feed.done.value"
      :loading="feed.loading.value"
      :error="feed.error.value && t(feed.error.value)"
      @more="feed.loadMore"
    />
    <UiEmptyState v-else-if="filtered" :title="t('gallery.filters.noMatch')">
      <template #action>
        <UiButton variant="secondary" @click="change({})">{{ t('gallery.filters.clear') }}</UiButton>
      </template>
    </UiEmptyState>
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

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
