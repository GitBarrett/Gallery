<script setup lang="ts">
// Hero of the home (US-24.1, Main mockup, 07 § Hero de la home): the capture chosen by the admin (or its fallback,
// Q89) across the whole width, cropped on its focal point, under the transparent header; a top scrim for the header,
// a horizontal one for the text at the bottom left and a fade into the page; title, two calls to action and the
// credit of its author, linked to its page. Without a capture, the same text on the page gradient. The image is the
// LCP: priority.
import type { HomeResponse } from '~~/shared/contracts/photos'

const props = defineProps<{ hero: HomeResponse['hero'] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const focal = computed(() => {
  const h = props.hero
  return h ? `${(h.focalX ?? 0.5) * 100}% ${(h.focalY ?? 0.5) * 100}%` : undefined
})
</script>

<template>
  <section class="hero" aria-labelledby="home-title">
    <UiWowImage
      v-if="hero"
      :photo-id="hero.id"
      alt=""
      :width="hero.width"
      :height="hero.height"
      priority
      sizes="100vw"
      class="image"
      :style="{ '--focal': focal }"
    />
    <span class="scrim" aria-hidden="true"></span>
    <div class="text">
      <h1 id="home-title" class="title">{{ t('home.hero.title') }}</h1>
      <p class="lead">{{ t('home.hero.lead') }}</p>
      <div class="actions">
        <UiButton :to="localePath('/upload')" size="lg">{{ t('home.hero.upload') }}</UiButton>
        <UiButton :to="localePath('/explore')" variant="secondary" size="lg">{{ t('home.hero.explore') }}</UiButton>
      </div>
      <p v-if="hero" class="credit">
        {{ t('home.hero.credit', { title: hero.title }) }}
        <NuxtLink :to="localePath(`/p/${hero.id}`)">{{ hero.author.username }}</NuxtLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Across the whole width, out of the centred content column (the layout clips the horizontal overflow) */
.hero {
  position: relative;
  left: 50%;
  display: flex;
  align-items: flex-end;
  width: 100vw;
  min-height: 70svh;
  margin-top: calc(-1 * var(--space-4));
  overflow: hidden;
  background: linear-gradient(160deg, var(--color-surface-raised) 0%, var(--color-bg) 70%);
  translate: -50% 0;
}

@media (width >= 1024px) {
  .hero {
    min-height: max(70svh, 680px);
  }
}

.hero .image {
  position: absolute;
  inset: 0;
  height: 100%;
  object-fit: cover;
  object-position: var(--focal, 50% 50%);
}

.scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, var(--color-veil) 0%, transparent 22%),
    linear-gradient(to top, var(--color-bg) 0%, transparent 35%),
    linear-gradient(to right, var(--color-veil) 0%, transparent 75%);
}

.text {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.title {
  max-width: 14ch;
  margin: 0;
  color: var(--color-white);
  font-family: var(--font-display);
  font-size: var(--text-5xl);
  line-height: var(--leading-tight);
}

.lead {
  max-width: 46ch;
  margin: 0;
  color: var(--color-white);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* Always on a dark background (07 § Hero) */
.credit {
  align-self: flex-start;
  margin: 0;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-veil-max);
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}

.credit a {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
}
</style>
