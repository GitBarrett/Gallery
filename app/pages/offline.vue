<script setup lang="ts">
// Offline page (US-64.2): precached by the service worker, shown for a page that is not in the cache.
import CachedPages from '~/features/offline/CachedPages.vue'

const { t } = useI18n()
useHead({ title: () => t('offline.title') })
</script>

<template>
  <UiEmptyState :heading-level="1" :title="t('offline.title')" :description="t('offline.text')">
    <template #action><CachedPages /></template>
  </UiEmptyState>
</template>
