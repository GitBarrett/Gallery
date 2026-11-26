<script setup lang="ts">
// Version tabs (Category and Main mockups): a link per game version not archived, to its PLP; the current one, if
// any, marked. Shared by the PLP and the home (US-24.2).
import type { GameVersionsResponse } from '~~/shared/contracts/catalog'

defineProps<{ versions: GameVersionsResponse['versions']; current?: string }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const nameOf = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
</script>

<template>
  <nav :aria-label="t('gallery.versions')">
    <ul class="versions">
      <li v-for="v in versions" :key="v.slug">
        <NuxtLink
          :to="localePath(`/v/${v.slug}`)"
          class="version"
          :aria-current="v.slug === current ? 'page' : undefined"
        >
          {{ nameOf(v) }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
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
