<script setup lang="ts">
// Shared header (07-design.md § Header): one line from 1180 px, icon-only navigation from 768 px, below that the
// emblem, search icon and profile or Sign in (the tab bar takes the navigation), hidden while scrolling down.
import type { FeatureFlags } from '~/composables/useFeatureFlags'
import UnreadBadge from '~/features/notifications/UnreadBadge.vue'
import NavIcon, { type NavIconName } from './NavIcon.vue'

const props = defineProps<{ flags: FeatureFlags; username?: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const online = useOnline()

const items = computed(() =>
  (
    [
      { to: localePath('/explore'), label: t('layout.explore'), icon: 'explore', on: true },
      {
        to: localePath('/leaderboard'),
        label: t('layout.leaderboard'),
        icon: 'leaderboard',
        on: props.flags.leaderboard,
      },
      { to: localePath('/contests'), label: t('layout.contests'), icon: 'contests', on: props.flags.contests },
      {
        to: localePath('/collections'),
        label: t('layout.collections'),
        icon: 'collections',
        on: props.flags.collections,
      },
    ] satisfies { to: string; label: string; icon: NavIconName; on: boolean }[]
  ).filter((item) => item.on),
)

const hidden = ref(false)
let lastY = 0
function onScroll() {
  hidden.value = window.scrollY > lastY && window.scrollY > 64
  lastY = window.scrollY
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="header" :class="{ hidden }">
    <div class="bar">
      <NuxtLink :to="localePath('/')" class="home">
        <UiLogoMark class="logo-full" />
        <UiLogoMark compact class="logo-compact" />
      </NuxtLink>
      <nav :aria-label="t('layout.mainNav')" class="nav">
        <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="nav-link">
          <NavIcon :name="item.icon" />
          <span class="label">{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <form class="search" role="search" :action="localePath('/search')" method="get">
        <NavIcon name="search" class="search-glyph" />
        <label for="header-search" class="visually-hidden">{{ t('layout.search') }}</label>
        <input
          id="header-search"
          type="search"
          name="q"
          :placeholder="t('layout.searchPlaceholder')"
          class="search-input"
        />
      </form>
      <NuxtLink :to="localePath('/search')" class="icon-link mobile-only" :aria-label="t('layout.search')">
        <NavIcon name="search" />
      </NuxtLink>
      <!-- Offline, uploading is impossible (US-64.3): disabled, with the reason -->
      <UiButton
        :to="localePath('/upload')"
        :disabled="!online"
        :title="online ? undefined : t('offline.banner')"
        class="desktop-only"
        ><NavIcon name="upload" />{{ t('layout.upload') }}</UiButton
      >
      <template v-if="username">
        <NuxtLink :to="localePath('/notifications')" class="icon-link bell desktop-only">
          <NavIcon name="notifications" />
          <span class="visually-hidden">{{ t('layout.notifications') }}</span>
          <UnreadBadge />
        </NuxtLink>
        <NuxtLink :to="localePath(`/u/${username}`)" class="icon-link" :aria-label="t('layout.myProfile')">
          <NavIcon name="profile" />
        </NuxtLink>
      </template>
      <UiButton v-else :to="localePath('/signin')" variant="secondary">{{ t('layout.signIn') }}</UiButton>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  padding-top: env(safe-area-inset-top);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  background: var(--color-surface);
  transition: transform var(--duration-normal) var(--ease-out);
}

.bar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-2) max(var(--space-4), env(safe-area-inset-right)) var(--space-2)
    max(var(--space-4), env(safe-area-inset-left));
}

.home {
  display: flex;
  flex: none;
  justify-content: center;
  min-width: var(--control-md);
  margin-right: auto;
  text-decoration: none;
}

.nav {
  gap: var(--space-0-5);
}

.nav-link,
.icon-link {
  display: inline-flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-width: var(--control-md);
  height: var(--control-md);
  padding: 0 var(--space-2-5);
  border-radius: var(--radius-md);
  color: var(--color-text-soft);
  font-weight: var(--weight-semibold);
  text-decoration: none;
  white-space: nowrap;
}

.icon-link {
  padding: 0;
}

.bell {
  position: relative;
}

.nav-link:hover,
.icon-link:hover,
.nav-link[aria-current='page'] {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.search {
  flex: 1 1 10rem;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.search:focus-within {
  box-shadow: var(--focus-ring);
}

.search-glyph {
  flex: none;
  width: 1.125rem;
  color: var(--color-text-faint);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: var(--control-md);
  border: 0;
  outline: none;
  background: transparent;
}

/* The ring is drawn on the frame (.search:focus-within) */
.search-input:focus-visible {
  box-shadow: none;
}

/* Prefixed by .bar to beat the root styles of UiLogoMark and UiButton */
.bar .logo-full,
.bar .nav,
.bar .search,
.bar .desktop-only {
  display: none;
}

/* Hidden while scrolling down on mobile, unless it holds the keyboard focus */
@media (width < 768px) {
  .hidden:not(:focus-within) {
    transform: translateY(-100%);
  }
}

@media (width >= 768px) {
  .home {
    margin-right: 0;
  }

  .bar .logo-compact,
  .bar .mobile-only {
    display: none;
  }

  .bar .logo-full,
  .bar .nav,
  .bar .search,
  .bar .desktop-only {
    display: flex;
  }
}

/* Icon-only navigation below 1180 px; the label stays for screen readers */
@media (width < 1180px) {
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
