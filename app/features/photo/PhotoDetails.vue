<script setup lang="ts">
// Details of a capture as an item of the game (Photo mockup, UiItemTooltip): title in its quality colour, its tier and
// version, zone and in-game time, settings, character, size and format, the author's caption, then the publication
// date and the downloads from 10 (US-70.6). Only what the capture has: no empty line. All author text as text.
import type { PhotoResponse } from '~~/shared/contracts/photos'
import { shownCount } from '~~/shared/domain/counters'

const props = defineProps<{ photo: PhotoResponse }>()
const { t, locale, n } = useI18n()
const named = (v: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? v.nameFr : v.nameEn)
const FORMATS: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' }
const place = computed(() => {
  const zone = props.photo.zone && named(props.photo.zone)
  const time = props.photo.inGameTime && t('photo.details.inGame', { time: props.photo.inGameTime })
  return [zone, time].filter(Boolean).join(' · ')
})
const credit = computed(() => {
  const date = new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' })
  const published = t('photo.details.published', { date: date.format(new Date(props.photo.publishedAt)) })
  const downloads =
    shownCount(props.photo.downloads) && t('photo.details.downloads', { count: n(props.photo.downloads) })
  return [published, downloads].filter(Boolean).join(' · ')
})
</script>

<template>
  <UiItemTooltip :title="photo.title" :quality="photo.quality" :caption="photo.caption ?? undefined" :credit="credit">
    <p class="line">
      {{ t('photo.details.tier', { quality: t(`quality.${photo.quality}`), version: named(photo.version) }) }}
    </p>
    <p v-if="place" class="line">{{ place }}</p>
    <p v-if="photo.graphicsSettings" class="line">{{ photo.graphicsSettings }}</p>
    <p v-if="photo.characterName" class="line">
      {{ t('photo.details.character', { name: photo.characterName }) }}
    </p>
    <p class="line">
      {{ t('photo.details.size', { width: photo.width, height: photo.height, format: FORMATS[photo.mime] ?? '' }) }}
    </p>
  </UiItemTooltip>
</template>

<style scoped>
.line {
  margin: 0;
}
</style>
