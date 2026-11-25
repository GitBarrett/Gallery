<script setup lang="ts">
// Live preview of the upload form (Upload mockup): the capture as it will start, Poor (07-design.md § Codes visuels
// WoW), its card and its item tooltip, updated while the member types.
const props = defineProps<{
  thumbnail?: string
  title: string
  version?: string
  zone?: string
  time?: string
  width?: number
  height?: number
  caption?: string
  /** Focal point of the crop (US-13.1); none: the centre (US-13.2). */
  focal?: { x: number; y: number } | null
}>()
const { t } = useI18n()
const name = computed(() => props.title.trim() || t('upload.preview.untitled'))
</script>

<template>
  <aside class="preview" aria-labelledby="upload-preview-title">
    <h2 id="upload-preview-title" class="title">{{ t('upload.preview.title') }}</h2>
    <div class="card">
      <div class="image">
        <img
          v-if="thumbnail"
          :src="thumbnail"
          alt=""
          class="thumbnail"
          :style="focal ? { objectPosition: `${focal.x * 100}% ${focal.y * 100}%` } : undefined"
        />
        <UiQualityBadge quality="poor" :label="t('quality.poor')" class="badge" />
      </div>
      <p class="name">{{ name }}</p>
    </div>
    <UiItemTooltip :title="name" quality="poor" :use="t('upload.preview.use')" :caption="caption || undefined">
      <p class="line">{{ t('upload.preview.kind', { version: version ?? '—' }) }}</p>
      <p v-if="zone || time" class="line split">
        <span>{{ zone }}</span><span v-if="time">{{ t('upload.preview.time', { time }) }}</span>
      </p>
      <p v-if="width && height" class="line">{{ width }} × {{ height }}</p>
    </UiItemTooltip>
    <p class="note">{{ t('upload.preview.quality') }}</p>
  </aside>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.card {
  overflow: hidden;
  border: var(--border-width) solid var(--quality-poor);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.image {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--color-surface-raised);
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.name {
  margin: 0;
  padding: var(--space-2-5) var(--space-3);
  color: var(--quality-poor);
  font-family: var(--font-display);
  font-weight: var(--weight-bold);
}

.line {
  margin: 0;
}

.split {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.note {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}
</style>
