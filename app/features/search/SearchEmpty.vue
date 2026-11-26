<script setup lang="ts">
// A search without result (US-21.6, 07-design.md § États vides): the close names to try, the popular tags, the latest
// captures; only the blocks that have something (never an empty block).
import type { SearchResponse } from '~~/shared/contracts/photos'
import GalleryMasonry from '~/features/gallery/GalleryMasonry.vue'

defineProps<{ query: string; empty: NonNullable<SearchResponse['empty']> }>()
const { t } = useI18n()
const localePath = useLocalePath()
const searchOf = (q: string) => localePath({ path: '/search', query: { q } })
</script>

<template>
  <div class="empty">
    <UiEmptyState :title="t('search.noResult', { query })" :description="t('search.noResultText')" />
    <section v-if="empty.suggestions.length" class="block" aria-labelledby="search-suggestions">
      <h2 id="search-suggestions" class="heading">{{ t('search.didYouMean') }}</h2>
      <ul class="chips">
        <li v-for="name in empty.suggestions" :key="name">
          <NuxtLink :to="searchOf(name)" class="chip">{{ name }}</NuxtLink>
        </li>
      </ul>
    </section>
    <section v-if="empty.popularTags.length" class="block" aria-labelledby="search-tags">
      <h2 id="search-tags" class="heading">{{ t('search.popularTags') }}</h2>
      <ul class="chips">
        <li v-for="tag in empty.popularTags" :key="tag">
          <NuxtLink :to="searchOf(tag)" class="chip">#{{ tag }}</NuxtLink>
        </li>
      </ul>
    </section>
    <section v-if="empty.latest.length" class="block" aria-labelledby="search-latest">
      <h2 id="search-latest" class="heading">{{ t('search.latest') }}</h2>
      <GalleryMasonry :captures="empty.latest" :label="t('search.latest')" />
    </section>
  </div>
</template>

<style scoped>
.empty,
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.heading {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* US-67.5: a touch target of 44 px */
.chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
}

.chip:focus-visible {
  box-shadow: var(--focus-ring);
}
</style>
