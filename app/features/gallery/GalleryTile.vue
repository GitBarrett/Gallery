<script setup lang="ts">
// A capture of the grid (Category mockup): the image at its own ratio, the quality badge in a corner, then under the
// image (never on it, 07-design.md § Texte sur image) its title in the colour of its quality, zone and author, and
// its likes from 10 on (« New » below, 07 § Aucun bloc vide). The link to the photo page comes with it (T-31a).
import type { GridCapture } from './useGalleryFeed'

const props = defineProps<{ capture: GridCapture }>()
const { t, locale } = useI18n()
const zone = computed(() => {
  const z = props.capture.zone
  return z && (locale.value === 'fr' ? z.nameFr : z.nameEn)
})
// US-75.3: the text written by the author comes with the photo page (T-31a)
const alt = computed(() => t('captures.alt', { title: props.capture.title, author: props.capture.author.username }))
</script>

<template>
  <article class="tile">
    <div class="frame">
      <UiWowImage
        :photo-id="capture.id"
        :alt="alt"
        :width="capture.width"
        :height="capture.height"
        sizes="(width >= 1280px) 20vw, (width >= 1024px) 25vw, (width >= 768px) 33vw, 50vw"
      />
      <UiQualityBadge :quality="capture.quality" :label="t(`quality.${capture.quality}`)" class="badge" />
    </div>
    <div class="caption">
      <div class="text">
        <p class="title" :class="capture.quality">{{ capture.title }}</p>
        <p class="meta">{{ zone ? `${zone} · ${capture.author.username}` : capture.author.username }}</p>
      </div>
      <span v-if="capture.likes >= 10" class="likes">{{ t('gallery.likes', { count: capture.likes }) }}</span>
      <span v-else class="new">{{ t('gallery.new') }}</span>
    </div>
  </article>
</template>

<style scoped>
.tile {
  overflow: hidden;
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.frame {
  position: relative;
}

.badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.caption {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
}

.text {
  min-width: 0;
}

.title,
.meta {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-weight: var(--weight-semibold);
}

.title.poor {
  color: var(--quality-poor);
}

.title.uncommon {
  color: var(--quality-uncommon);
}

.title.rare {
  color: var(--quality-rare);
}

.title.epic {
  color: var(--quality-epic);
}

.title.legendary {
  color: var(--quality-legendary);
}

.meta,
.likes,
.new {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.likes,
.new {
  flex: none;
}
</style>
