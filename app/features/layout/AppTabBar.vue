<script setup lang="ts">
// Bottom tab bar below 768 px (07-design.md § Responsive, US-67.1): Explore · Search · Upload (centre, emphasised)
// · Notifications · Profile at launch; Leaderboard takes Search's place and Contests Notifications' with their flag.
// shortcut: English texts, moved to i18n in T-07b
import type { FeatureFlags } from '~/composables/useFeatureFlags'
import NavIcon, { type NavIconName } from './NavIcon.vue'

const props = defineProps<{ flags: FeatureFlags; username?: string }>()

const tabs = computed((): { to: string; label: string; icon: NavIconName }[] => [
  { to: '/explore', label: 'Explore', icon: 'explore' },
  props.flags.leaderboard
    ? { to: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' }
    : { to: '/search', label: 'Search', icon: 'search' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
  props.flags.contests
    ? { to: '/contests', label: 'Contests', icon: 'contests' }
    : { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  { to: props.username ? `/u/${props.username}` : '/signin', label: 'Profile', icon: 'profile' },
])
</script>

<template>
  <nav aria-label="Main" class="tab-bar">
    <NuxtLink v-for="tab in tabs" :key="tab.icon" :to="tab.to" class="tab" :class="{ upload: tab.icon === 'upload' }">
      <span class="glyph"><NavIcon :name="tab.icon" /></span>
      <span class="label">{{ tab.label }}</span>
    </NuxtLink>
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
