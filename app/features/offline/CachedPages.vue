<script setup lang="ts">
// Pages saved by the service worker (cache `pages`, 03-architecture.md § PWA), listed on /offline (US-64.2).
// Read in the browser only: the server has no cache.
const { t } = useI18n()
const paths = ref<string[]>([])

onMounted(async () => {
  if (!('caches' in window)) return
  const requests = await (await caches.open('pages')).keys()
  paths.value = [...new Set(requests.map((request) => new URL(request.url).pathname))].sort()
})
</script>

<template>
  <ul v-if="paths.length" class="pages">
    <li v-for="path in paths" :key="path">
      <a :href="path" class="page">{{ path }}</a>
    </li>
  </ul>
  <p v-else class="none">{{ t('offline.none') }}</p>
</template>

<style scoped>
.pages {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 0;
  list-style: none;
}

.page {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  color: var(--color-accent);
}

.none {
  color: var(--color-text-muted);
}
</style>
