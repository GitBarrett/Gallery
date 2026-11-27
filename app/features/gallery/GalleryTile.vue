<script setup lang="ts">
// A capture of the grid (Category mockup): the image at its own ratio, the quality badge in a corner, then under the
// image (never on it, 07-design.md § Texte sur image) its title in the colour of its quality, zone and author, and
// its likes from 10 on (« New » below, 07 § Aucun bloc vide). The whole tile leads to the photo page (a touch target
// as large as the capture).
import { qualityProgress } from '~~/shared/domain/quality'
import type { GridCapture } from './useGalleryFeed'

const props = defineProps<{ capture: GridCapture; progress?: boolean }>()
const { t, locale } = useI18n()
const settings = usePublicSettings()
// One's own profile (07 § Qualité, point 6): the likes towards the next tier, with the current thresholds
const step = computed(() => {
  const thresholds = settings.value?.qualityThresholds
  if (!props.progress || !thresholds) return null
  const { from, next } = qualityProgress(props.capture.likes, thresholds)
  if (!next) return { value: 1, max: 1, label: t('profile.progress.top') }
  const done = props.capture.likes - from
  const label = t('profile.progress.next', { count: next.missing, quality: t(`quality.${next.quality}`) }, next.missing)
  return { value: done, max: done + next.missing, label }
})
const localePath = useLocalePath()
const zone = computed(() => {
  const z = props.capture.zone
  return z && (locale.value === 'fr' ? z.nameFr : z.nameEn)
})
// US-75.3: the grid has no alternative text of the author (the photo page shows it)
const alt = computed(() => t('captures.alt', { title: props.capture.title, author: props.capture.author.username }))
</script>

<template>
  <article class="tile">
    <NuxtLink :to="localePath(`/p/${capture.id}`)" class="link">
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
      <div v-if="step" class="progress">
        <progress :value="step.value" :max="step.max" :aria-label="step.label"></progress>
        <span class="step">{{ step.label }}</span>
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
/* The link is the card: its focus ring is drawn around it, outside its rounded, clipped corners */
.link {
  display: block;
  overflow: hidden;
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
}

.link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.frame {
  position: relative;
}

.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 0 var(--space-3) var(--space-2);
}

.progress progress {
  width: 100%;
  accent-color: var(--color-accent);
}

.step {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
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
