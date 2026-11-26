<script setup lang="ts">
// « Download original » of the photo page (US-23, Photo mockup): the browser opens the URL of the original signed for
// 5 minutes and saves it (an attachment). A visitor is sent to sign in, then back to the page with `?download=1`,
// where the download starts once (US-23.2). The size is the one of the cleaned original.
import { api, ApiError, errorMessageKey } from '~/services/api'

const props = defineProps<{ photoId: string; bytes: number }>()
const { t, n } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const busy = ref(false)
const error = ref<string>()
const size = computed(() => n(props.bytes / 1_000_000, { maximumFractionDigits: 1 }))

async function download() {
  if (busy.value) return
  busy.value = true
  error.value = undefined
  try {
    const { url } = await api.download(props.photoId)
    await navigateTo(url, { external: true })
  } catch (thrown) {
    if (thrown instanceof ApiError && thrown.code === 'UNAUTHENTICATED')
      return void (await navigateTo({ path: localePath('/signin'), query: { redirect: `${route.path}?download=1` } }))
    error.value = errorMessageKey(thrown)
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (route.query.download !== '1') return
  const { download: _, ...query } = route.query
  await navigateTo({ query }, { replace: true }) // a reload or the back button does not download again
  await download()
})
</script>

<template>
  <div class="download">
    <UiButton :disabled="busy" @click="download">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
      </svg>
      {{ t('photo.download.label', { size }) }}
    </UiButton>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
  </div>
</template>

<style scoped>
.download {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.icon {
  width: var(--space-4);
  height: var(--space-4);
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
