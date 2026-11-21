<script setup lang="ts">
// Capture image (03-architecture.md § Performance): alternative text mandatory, width and height always set
// (no layout shift), lazy except the page's main image. shortcut: a single `src` until the /img route (T-25a);
// srcset 400/800/1200/2400 and sizes arrive with T-25b.
withDefaults(defineProps<{ src: string; alt: string; width: number; height: number; priority?: boolean }>(), {
  priority: false,
})
</script>

<template>
  <img
    class="wow-image"
    :src="src"
    :alt="alt"
    :width="width"
    :height="height"
    :loading="priority ? 'eager' : 'lazy'"
    :fetchpriority="priority ? 'high' : undefined"
    decoding="async"
  />
</template>

<style scoped>
.wow-image {
  display: block;
  width: 100%;
  height: auto;
}
</style>
