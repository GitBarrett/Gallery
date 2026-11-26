<script setup lang="ts">
// « Capture of the week » of the home (US-70.4, Main mockup): the capture chosen by the server and the step that chose
// it (this week, this month, all time, editor's pick), as a tile leading to its page. No block when there is none
// (the page leaves it out).
import type { HomeResponse } from '~~/shared/contracts/photos'
import GalleryTile from '~/features/gallery/GalleryTile.vue'

defineProps<{ week: NonNullable<HomeResponse['week']> }>()
const { t } = useI18n()
</script>

<template>
  <section class="week" aria-labelledby="week-title">
    <div class="heading">
      <p class="reason">{{ t(`home.week.${week.reason}`) }}</p>
      <h2 id="week-title" class="title">{{ t('home.week.title') }}</h2>
    </div>
    <div class="capture"><GalleryTile :capture="week.capture" /></div>
  </section>
</template>

<style scoped>
.week {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.reason,
.title {
  margin: 0;
}

.reason {
  color: var(--color-accent);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.capture {
  max-width: 640px;
}
</style>
