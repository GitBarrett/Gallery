<script setup lang="ts">
// Previous and next captures of the version (Photo mockup: round buttons at the foot of the image), as links: they
// work without script and for robots. At either end of the version the button is left out (no wrap-around, Q87).
defineProps<{ prev: string | null; next: string | null }>()
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <nav v-if="prev || next" class="photo-nav" :aria-label="t('photo.nav.label')">
    <NuxtLink v-if="prev" :to="localePath(`/p/${prev}`)" class="button prev" :aria-label="t('photo.nav.prev')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
    </NuxtLink>
    <NuxtLink v-if="next" :to="localePath(`/p/${next}`)" class="button next" :aria-label="t('photo.nav.next')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.photo-nav {
  display: flex;
  justify-content: space-between;
  pointer-events: none; /* the image stays under the swipe; only the buttons take touches */
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-md);
  height: var(--control-md);
  border: var(--border-width) solid var(--color-tooltip-border);
  border-radius: var(--radius-pill);
  background: var(--color-veil);
  color: var(--color-white);
  pointer-events: auto;
}

.button:focus-visible {
  box-shadow: var(--focus-ring);
}

.next {
  margin-left: auto;
}

svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
</style>
