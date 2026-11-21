<script setup lang="ts">
// "You're offline" banner (US-64.3), driven by the browser's online and offline events.
const { t } = useI18n()
const offline = ref(false)
const update = () => (offline.value = !navigator.onLine)

onMounted(() => {
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>

<template>
  <p v-if="offline" role="status" class="banner">{{ t('offline.banner') }}</p>
</template>

<style scoped>
.banner {
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-align: center;
}
</style>
