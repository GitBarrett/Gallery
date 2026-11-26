<script setup lang="ts">
// Quality badge of the photo page (US-71.2, 07 § Expliquer la qualité 2): hovered, focused or touched, it tells the
// tier, its threshold and the likes missing for the next one (« Rare · 15+ likes · 35 likes to Epic »), from the
// thresholds of site_settings. A button, so the keyboard reaches it (no hover-only content); a touch opens a bottom
// sheet with the same text (US-67.3), a mouse click toggles the tooltip.
import { qualityProgress, type Quality } from '~~/shared/domain/quality'

const props = defineProps<{ quality: Quality; likes: number }>()
const { t, n } = useI18n()
const settings = usePublicSettings()
const open = ref(false)
const sheet = ref(false)
const id = useId()
const touch = () => window.matchMedia('(pointer: coarse)').matches
const press = () => (touch() ? (sheet.value = true) : (open.value = !open.value))
const text = computed(() => {
  const thresholds = settings.value?.qualityThresholds
  const name = t(`quality.${props.quality}`)
  if (!thresholds) return name
  const { from, next } = qualityProgress(props.likes, thresholds)
  const parts = [name, from ? t('photo.quality.from', { count: n(from) }) : t('photo.quality.new')]
  if (next) parts.push(t('photo.quality.missing', { count: n(next.missing), quality: t(`quality.${next.quality}`) }))
  return parts.join(' · ')
})
</script>

<template>
  <span class="quality-tip" @mouseleave="open = false" @keydown.esc="open = false">
    <button type="button" class="badge" :aria-expanded="open" :aria-describedby="id" @click="press">
      <UiQualityBadge :quality="quality" :label="t(`quality.${quality}`)" />
    </button>
    <span :id="id" role="tooltip" class="tip" :class="{ open }">{{ text }}</span>
    <UiBottomSheet v-model:open="sheet" :title="t(`quality.${quality}`)" :close-label="t('photo.quality.close')">
      <p class="sheet-text">{{ text }}</p>
    </UiBottomSheet>
  </span>
</template>

<style scoped>
.quality-tip {
  position: relative;
  display: inline-block;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-md);
  min-height: var(--control-md);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.badge:focus-visible {
  box-shadow: var(--focus-ring);
}

.tip {
  position: absolute;
  z-index: var(--z-header);
  top: calc(100% + var(--space-1));
  right: 0;
  display: none;
  width: max-content;
  max-width: min(280px, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-tooltip-border);
  border-radius: var(--radius-md);
  background: var(--color-tooltip-bg);
  color: var(--color-white);
  font-size: var(--text-sm);
}

.badge:focus-visible + .tip,
.tip.open {
  display: block;
}

/* A touch screen keeps :hover after a tap: there, the bottom sheet shows the text */
@media (hover: hover) {
  .quality-tip:hover .tip {
    display: block;
  }
}

.sheet-text {
  margin: 0;
}
</style>
