<script setup lang="ts">
// Filters of the PLP and of the search (07-design.md § Responsive): a bar from 768 px; below, a « Filters » button
// that opens them in a full-screen bottom sheet, each change applied at once behind it. The fields come from the slot,
// given the quality thresholds of site_settings.
const { t } = useI18n()
const settings = usePublicSettings()
const thresholds = computed(() => settings.value?.qualityThresholds ?? null)
const open = ref(false)
</script>

<template>
  <section class="filters" :aria-label="t('gallery.filters.title')">
    <div class="bar">
      <slot :thresholds="thresholds" />
    </div>
    <UiButton variant="secondary" class="open" @click="open = true">{{ t('gallery.filters.title') }}</UiButton>
    <UiBottomSheet
      v-model:open="open"
      full
      :title="t('gallery.filters.title')"
      :close-label="t('gallery.filters.close')"
    >
      <slot v-if="open" :thresholds="thresholds" />
      <template #actions>
        <UiButton block @click="open = false">{{ t('gallery.filters.show') }}</UiButton>
      </template>
    </UiBottomSheet>
  </section>
</template>

<style scoped>
.open {
  align-self: flex-start;
}

@media (width < 768px) {
  .bar {
    display: none;
  }
}

@media (width >= 768px) {
  .open {
    display: none;
  }
}
</style>
