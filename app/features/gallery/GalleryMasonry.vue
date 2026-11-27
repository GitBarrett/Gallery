<script setup lang="ts">
// Masonry of capture tiles (07-design.md § Responsive: 2 columns and an 8 px gutter below 768 px, then 3, 4 and 5),
// shared by the PLP grid and the latest captures of the home.
import GalleryTile from './GalleryTile.vue'
import type { GridCapture } from './useGalleryFeed'

defineProps<{ captures: GridCapture[]; label: string; progress?: boolean }>()
</script>

<template>
  <ul class="grid" :aria-label="label">
    <li v-for="capture in captures" :key="capture.id" class="cell">
      <GalleryTile :capture="capture" :progress="progress" />
    </li>
  </ul>
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
</style>
