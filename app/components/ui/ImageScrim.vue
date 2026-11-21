<script setup lang="ts">
// Veil between a photo and its text (07-design.md § Texte sur image): never text straight on a photo. The image
// goes in the default slot, the text in `caption`, bottom-left; `max` for bright photos (luma above 0.6, T-25b).
withDefaults(defineProps<{ level?: 'default' | 'max' }>(), { level: 'default' })
</script>

<template>
  <div class="image-scrim">
    <slot />
    <div class="veil" :class="level"><slot name="caption" /></div>
  </div>
</template>

<style scoped>
.image-scrim {
  position: relative;
  overflow: hidden;
}

.veil {
  --veil: var(--color-veil);

  position: absolute;
  inset: auto 0 0;
  padding: var(--space-12) var(--space-4) var(--space-4);
  background: linear-gradient(to top, var(--veil) 0%, var(--veil) 45%, var(--color-veil-faint) 100%);
  color: var(--color-text);
  text-align: start;
}

.max {
  --veil: var(--color-veil-max);
}
</style>
