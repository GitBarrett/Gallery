<script setup lang="ts">
// Focal point of a capture (US-13.1, 07-design.md § Texte sur image 5): touched on the whole image, or set with two
// sliders (keyboard and screen readers); none means the centre (US-13.2). The crops keep this point in view.
const focal = defineModel<{ x: number; y: number } | null>({ default: null })
defineProps<{ src: string }>()
const { t } = useI18n()
const id = useId()

function pick(event: MouseEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const share = (offset: number, size: number) => Math.round(Math.min(1, Math.max(0, offset / size)) * 100) / 100
  focal.value = { x: share(event.clientX - box.left, box.width), y: share(event.clientY - box.top, box.height) }
}

const percent = (axis: 'x' | 'y') => Math.round((focal.value?.[axis] ?? 0.5) * 100)
function slide(axis: 'x' | 'y', event: Event) {
  const value = Number((event.target as HTMLInputElement).value) / 100
  focal.value = { x: 0.5, y: 0.5, ...focal.value, [axis]: value }
}
</script>

<template>
  <fieldset class="focal">
    <legend class="title">{{ t('upload.focal.title') }}</legend>
    <p :id="`${id}-hint`" class="hint">{{ t('upload.focal.hint') }}</p>
    <!-- The sliders below are the keyboard way to the same point -->
    <div class="frame" @click="pick">
      <img :src="src" alt="" class="image" />
      <span
        v-if="focal"
        class="marker"
        :style="{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }"
        aria-hidden="true"
      ></span>
    </div>
    <div class="controls">
      <label v-for="axis in ['x', 'y'] as const" :key="axis" class="slider">
        <span>{{ t(`upload.focal.${axis}`) }}</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="percent(axis)"
          :aria-valuetext="`${percent(axis)} %`"
          :aria-describedby="`${id}-hint`"
          @input="slide(axis, $event)"
        />
      </label>
      <UiButton variant="ghost" :disabled="!focal" @click="focal = null">{{ t('upload.focal.centre') }}</UiButton>
    </div>
  </fieldset>
</template>

<style scoped>
.focal {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.title {
  margin-bottom: var(--space-1);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.hint {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.frame {
  position: relative;
  max-width: 32rem;
  cursor: crosshair;
}

.image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

.marker {
  position: absolute;
  width: var(--space-6);
  height: var(--space-6);
  border: var(--border-width) solid var(--color-white);
  border-radius: var(--radius-pill);
  box-shadow: var(--focus-ring);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.slider {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.slider input {
  min-height: var(--control-md);
  accent-color: var(--color-accent);
}
</style>
