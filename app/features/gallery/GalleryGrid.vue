<script setup lang="ts">
// Grid of the PLP: the masonry of tiles, then infinite scroll (US-20.2): the next page loads when the end of the grid
// comes near; the « Load more » button does the same from the keyboard or without IntersectionObserver. After the
// last page: « You've seen everything ».
import GalleryMasonry from './GalleryMasonry.vue'
import type { GridCapture } from './useGalleryFeed'

const props = defineProps<{
  captures: GridCapture[]
  label: string
  done: boolean
  loading: boolean
  error?: string
}>()
const emit = defineEmits<{ more: [] }>()
const { t } = useI18n()

const end = ref<HTMLElement>()
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (!('IntersectionObserver' in window) || !end.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && !props.done && !props.loading) emit('more')
    },
    { rootMargin: '600px 0px' },
  )
  observer.observe(end.value)
})
// A page that leaves the end in view fires no new intersection: observing again reports it once more
watch(
  () => props.captures.length,
  () => {
    if (!observer || !end.value) return
    observer.unobserve(end.value)
    observer.observe(end.value)
  },
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="gallery">
    <GalleryMasonry :captures="captures" :label="label" />
    <div ref="end" class="end">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="done" class="done">{{ t('gallery.end') }}</p>
      <UiButton v-else variant="secondary" :disabled="loading" @click="emit('more')">
        {{ t('gallery.loadMore') }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.end {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-6) 0;
}

.done,
.error {
  margin: 0;
}

.done {
  color: var(--color-text-faint);
}

.error {
  color: var(--color-danger);
}
</style>
