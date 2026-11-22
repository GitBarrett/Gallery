<script setup lang="ts">
// Update toast (US-65): a new service worker waits; Reload activates it (skipWaiting on demand) and reloads the page,
// never during an upload. Without the PWA plugin (dev, tests) there is never a new version.
const { t } = useI18n()
const pwa = useNuxtApp().$pwa
const uploading = useUploadInProgress()
const dismissed = ref(false)
const open = computed({
  get: () => Boolean(pwa?.needRefresh) && !uploading.value && !dismissed.value,
  set: (value) => (dismissed.value = !value),
})
</script>

<template>
  <UiToast
    v-model:open="open"
    :message="t('pwa.updateAvailable')"
    :action-label="t('pwa.reload')"
    :dismiss-label="t('pwa.dismiss')"
    @action="pwa?.updateServiceWorker(true)"
  />
</template>
