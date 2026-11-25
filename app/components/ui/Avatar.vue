<script setup lang="ts">
// Avatar of a member (US-07.6, US-05.3): the square WebP shown at 64, 128 or 256 px, or the initial of the username
// when there is none or it fails to load. Decorative: the username is always written next to it, or the link that
// holds it carries a label.
const props = withDefaults(defineProps<{ src: string | null; name: string; size?: 'sm' | 'lg' }>(), { size: 'sm' })
const broken = ref(false)
watch(
  () => props.src,
  () => (broken.value = false),
)
const srcset = computed(() => [64, 128, 256].map((w) => `${props.src}/${w} ${w}w`).join(', '))
</script>

<template>
  <span class="avatar" :class="size">
    <img
      v-if="src && !broken"
      :src="`${src}/${size === 'sm' ? 64 : 256}`"
      :srcset="srcset"
      :sizes="size === 'sm' ? '32px' : '112px'"
      alt=""
      class="image"
      @error="broken = true"
    />
    <span v-else class="initial" aria-hidden="true">{{ name.charAt(0).toUpperCase() }}</span>
  </span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-surface-raised);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: var(--weight-bold);
}

.sm {
  width: 32px;
  height: 32px;
  border: var(--border-width) solid var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.lg {
  width: 112px;
  height: 112px;
  border: 3px solid var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--text-3xl);
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
