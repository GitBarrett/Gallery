<script setup lang="ts">
// Masonry grid of the PLP (07-design.md § Responsive: 2 columns and an 8 px gutter below 768 px, then 3, 4 and 5).
// Infinite scroll (US-20.2): the next page loads when the end of the grid comes near; the « Load more » button does
// the same from the keyboard or without IntersectionObserver. After the last page: « You've seen everything ».
import GalleryTile from './GalleryTile.vue'
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
    <ul class="grid" :aria-label="label">
      <li v-for="capture in captures" :key="capture.id" class="cell"><GalleryTile :capture="capture" /></li>
    </ul>
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
.grid {
  margin: 0;
  padding: 0;
  list-style: none;
  column-count: 2;
  column-gap: var(--space-2);
}

.cell {
  margin-bottom: var(--space-2);
  break-inside: avoid;
}

@media (width >= 768px) {
  .grid {
    column-count: 3;
    column-gap: var(--space-4);
  }

  .cell {
    margin-bottom: var(--space-4);
  }
}

@media (width >= 1024px) {
  .grid {
    column-count: 4;
  }
}

@media (width >= 1280px) {
  .grid {
    column-count: 5;
  }
}

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
