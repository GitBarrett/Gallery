<script setup lang="ts">
// "You're offline" banner (US-64.3).
const { t } = useI18n()
const online = useOnline()
</script>

<template>
  <p v-if="!online" role="status" class="banner">{{ t('offline.banner') }}</p>
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
