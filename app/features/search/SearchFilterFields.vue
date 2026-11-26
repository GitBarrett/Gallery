<script setup lang="ts">
// Filters of the search (US-21.1, Q91): game version, minimum quality with its « ? », sort by relevance, recency or
// likes. Each change is emitted at once; the page writes it to the URL. Ids from useId(): bar and sheet may coexist.
import type { QualityThresholds } from '~~/shared/domain/quality'
import QualityTiers from '~/features/gallery/QualityTiers.vue'
import { SEARCH_SORTS, type Search } from './query'

const props = defineProps<{
  search: Search
  versions: { slug: string; nameEn: string; nameFr: string }[]
  thresholds: QualityThresholds | null
}>()
const emit = defineEmits<{ change: [search: Search] }>()
const { t, locale } = useI18n()
const id = useId()
const set = (more: Partial<Search>) => emit('change', { ...props.search, ...more })
const selected = (event: Event) => (event.target as HTMLSelectElement).value || undefined
</script>

<template>
  <div class="fields">
    <div class="field">
      <label :for="`${id}-version`" class="label">{{ t('search.version') }}</label>
      <select
        :id="`${id}-version`"
        class="control"
        :value="search.version ?? ''"
        @change="set({ version: selected($event) })"
      >
        <option value="">{{ t('search.allVersions') }}</option>
        <option v-for="v in versions" :key="v.slug" :value="v.slug">
          {{ locale === 'fr' ? v.nameFr : v.nameEn }}
        </option>
      </select>
    </div>
    <QualityTiers
      :quality="search.minQuality ?? 'poor'"
      :thresholds="thresholds"
      @select="set({ minQuality: $event })"
    />
    <div class="field">
      <label :for="`${id}-sort`" class="label">{{ t('gallery.filters.sort') }}</label>
      <select
        :id="`${id}-sort`"
        class="control"
        :value="search.sort ?? 'relevance'"
        @change="set({ sort: selected($event) as Search['sort'] })"
      >
        <option v-for="sort in SEARCH_SORTS" :key="sort" :value="sort">{{ t(`search.sorts.${sort}`) }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.control {
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.control:focus-visible {
  box-shadow: var(--focus-ring);
}
</style>
