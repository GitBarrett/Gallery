<script setup lang="ts">
// Navigation glyphs (header and tab bar), decorative: the link carries the name.
const PATHS = {
  explore: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z M15.5 8.5l-2 5-5 2 2-5Z',
  leaderboard: 'M5 20v-8 M12 20V5 M19 20v-6',
  contests: 'M8 4h8v5a4 4 0 0 1-8 0Z M12 13v4 M8 20h8 M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4',
  collections: 'M4 7h16v13H4Z M7 4h10',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M15.5 15.5L20 20',
  upload: 'M12 16V4 M7 9l5-5 5 5 M5 20h14',
  notifications: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4Z M10 20a2 2 0 0 0 4 0',
  profile: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z M4 20a8 8 0 0 1 16 0',
}
export type NavIconName = keyof typeof PATHS
defineProps<{ name: NavIconName }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
