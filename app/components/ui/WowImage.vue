<script setup lang="ts">
// Capture image (03-architecture.md § Images responsive, ADR-012): the stored WebP widths of /img in a srcset, the
// browser picks one from `sizes`; alternative text mandatory, width and height always set (no layout shift), lazy
// except the page's main image. `preview`: the private preview of an unpublished capture (author, moderators).
const props = withDefaults(
  defineProps<{
    photoId: string
    alt: string
    width: number
    height: number
    priority?: boolean
    sizes?: string
    preview?: boolean
  }>(),
  { priority: false, sizes: '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw', preview: false },
)
const WIDTHS = [400, 800, 1200, 2400]
const url = (width: number) => `/img/${props.photoId}/${width}${props.preview ? '?preview=1' : ''}`
const srcset = computed(() => WIDTHS.map((width) => `${url(width)} ${width}w`).join(', '))
</script>

<template>
  <img
    class="wow-image"
    :src="url(1200)"
    :srcset="srcset"
    :sizes="sizes"
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
