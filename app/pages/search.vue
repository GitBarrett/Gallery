<script setup lang="ts">
// Search (US-21): the field with its suggestions, the filters and the results, rendered by the server from the URL
// (shared links and the back button give the same results); « Showing results for … » after a typo (US-21.2); the
// close names, popular tags and latest captures when nothing is found (US-21.6).
import GalleryFilters from '~/features/gallery/GalleryFilters.vue'
import GalleryGrid from '~/features/gallery/GalleryGrid.vue'
import { useGameVersions } from '~/features/gallery/useGameVersions'
import { readSearch, writeSearch, type Search } from '~/features/search/query'
import SearchBox from '~/features/search/SearchBox.vue'
import SearchEmpty from '~/features/search/SearchEmpty.vue'
import SearchFilterFields from '~/features/search/SearchFilterFields.vue'
import { useSearch } from '~/features/search/useSearch'

const route = useRoute()
const { t } = useI18n()
const search = computed(() => readSearch(route.query))
const versions = await useGameVersions()
const results = await useSearch(search)
if (!results.found.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
if (results.failed.value) throw createError({ statusCode: 500, statusMessage: 'Search unavailable', fatal: true })
// Each change is a new entry of the history, so the back button returns to the previous search
const change = (next: Search) => navigateTo({ query: writeSearch(next) })
const query = computed(() => results.page.value?.query ?? '')
useHead({
  title: () => (query.value ? t('search.titleFor', { query: query.value }) : t('search.title')),
  meta: [{ name: 'description', content: () => t('search.description') }],
})
</script>

<template>
  <div class="search">
    <h1 class="title">{{ query ? t('search.resultsFor', { query }) : t('search.title') }}</h1>
    <SearchBox :query="search.q" @search="change({ ...search, q: $event })" />
    <p v-if="results.failed.value" class="error" role="alert">{{ t('errors.INTERNAL') }}</p>
    <template v-else-if="results.page.value">
      <GalleryFilters v-slot="{ thresholds }">
        <SearchFilterFields :search="search" :versions="versions" :thresholds="thresholds" @change="change" />
      </GalleryFilters>
      <p v-if="results.page.value.corrected" class="corrected">
        {{ t('search.showingFor', { name: results.page.value.corrected }) }}
      </p>
      <GalleryGrid
        v-if="results.captures.value.length"
        :captures="results.captures.value"
        :label="t('search.resultsFor', { query })"
        :done="results.done.value"
        :loading="results.loading.value"
        :error="results.error.value && t(results.error.value)"
        @more="results.loadMore"
      />
      <SearchEmpty v-else-if="results.page.value.empty" :query="query" :empty="results.page.value.empty" />
      <UiEmptyState v-else :title="t('search.noResult', { query })" :description="t('search.noResultText')" />
    </template>
    <p v-else class="hint">{{ t('search.hint') }}</p>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  overflow-wrap: anywhere;
}

.corrected,
.hint,
.error {
  margin: 0;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
