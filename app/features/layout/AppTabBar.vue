<script setup lang="ts">
// Bottom tab bar below 768 px (07-design.md § Responsive, US-67.1): Explore · Search · Upload (centre, emphasised)
// · Notifications · Profile at launch; Leaderboard takes Search's place and Contests Notifications' with their flag.
import type { FeatureFlags } from '~/composables/useFeatureFlags'
import NavIcon, { type NavIconName } from './NavIcon.vue'

const props = defineProps<{ flags: FeatureFlags; username?: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const online = useOnline()

const tabs = computed((): { to: string; label: string; icon: NavIconName }[] =>
  [
    { to: '/explore', label: t('layout.explore'), icon: 'explore' as const },
    props.flags.leaderboard
      ? { to: '/leaderboard', label: t('layout.leaderboard'), icon: 'leaderboard' as const }
      : { to: '/search', label: t('layout.search'), icon: 'search' as const },
    { to: '/upload', label: t('layout.upload'), icon: 'upload' as const },
    props.flags.contests
      ? { to: '/contests', label: t('layout.contests'), icon: 'contests' as const }
      : { to: '/notifications', label: t('layout.notifications'), icon: 'notifications' as const },
    // shortcut: settings (sign-out) until the public profile /u/<username> exists, T-16
    { to: props.username ? '/settings' : '/signin', label: t('layout.profile'), icon: 'profile' as const },
  ].map((tab) => ({ ...tab, to: localePath(tab.to) })),
)
</script>

<template>
  <nav :aria-label="t('layout.mainNav')" class="tab-bar">
    <template v-for="tab in tabs" :key="tab.icon">
      <!-- Offline, uploading is impossible (US-64.3): the tab stays in place, disabled, with the reason -->
      <span
        v-if="tab.icon === 'upload' && !online"
        class="tab upload disabled"
        role="link"
        aria-disabled="true"
        :title="t('offline.banner')"
      >
        <span class="glyph"><NavIcon :name="tab.icon" /></span>
        <span class="label">{{ tab.label }}</span>
      </span>
      <NuxtLink v-else :to="tab.to" class="tab" :class="{ upload: tab.icon === 'upload' }">
        <span class="glyph"><NavIcon :name="tab.icon" /></span>
        <span class="label">{{ tab.label }}</span>
      </NuxtLink>
    </template>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  inset: auto 0 0;
  z-index: var(--z-header);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
  padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  border-top: var(--border-width) solid var(--color-border-subtle);
  background: var(--color-surface);
}

.tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  align-items: center;
  justify-content: center;
  min-width: 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  text-decoration: none;
}

.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tab[aria-current='page'] {
  color: var(--color-text);
}

.label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload .glyph {
  width: var(--control-md);
  height: var(--control-sm);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

@media (width >= 768px) {
  .tab-bar {
    display: none;
  }
}
</style>
