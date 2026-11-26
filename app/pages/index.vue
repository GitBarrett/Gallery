<script setup lang="ts">
// Home (US-24, US-70.4, Main mockup), rendered by the server: the hero under the transparent header, the quest banner
// (only with features.contests and an open contest: T-64), the version tabs, « Capture of the week » and the latest
// captures of every version. A block without content is left out, never shown empty (07 § Aucun bloc vide).
import GalleryMasonry from '~/features/gallery/GalleryMasonry.vue'
import { useGameVersions } from '~/features/gallery/useGameVersions'
import VersionNav from '~/features/gallery/VersionNav.vue'
import CaptureOfTheWeek from '~/features/home/CaptureOfTheWeek.vue'
import HomeHero from '~/features/home/HomeHero.vue'
import QuestBanner from '~/features/home/QuestBanner.vue'
import { useHome } from '~/features/home/useHome'

const { t } = useI18n()
const localePath = useLocalePath()
const [home, versions] = await Promise.all([useHome(), useGameVersions()])
const flags = useFeatureFlags()
usePageHead({ title: () => 'Legendary Shots', description: () => t('home.description'), path: () => '/' })
</script>

<template>
  <div class="home">
    <HomeHero :hero="home?.hero ?? null" />
    <QuestBanner :enabled="flags.contests" :contest="null" />
    <VersionNav :versions="versions" />
    <CaptureOfTheWeek v-if="home?.week" :week="home.week" />
    <section v-if="home?.latest.length" class="latest" aria-labelledby="latest-title">
      <div class="heading">
        <h2 id="latest-title" class="title">{{ t('home.latest.title') }}</h2>
        <NuxtLink :to="localePath('/explore')" class="all">{{ t('home.latest.all') }}</NuxtLink>
      </div>
      <GalleryMasonry :captures="home.latest" :label="t('home.latest.title')" />
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.latest {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: baseline;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.all {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
}
</style>
