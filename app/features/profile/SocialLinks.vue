<script setup lang="ts">
// Social networks of a profile (US-82.4, 07-design.md § Réseaux sociaux): house monochrome icons under the bio, links
// built by the server, opened apart without passing trust; Discord has no link, its username is copied.
import type { ProfileResponse } from '~~/shared/contracts/auth'

defineProps<{ links: ProfileResponse['socialLinks'] }>()
const { t } = useI18n()
const copied = ref(false)

const NAMES = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  x: 'X',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  discord: 'Discord',
  website: '',
} as const
const name = (platform: keyof typeof NAMES) => NAMES[platform] || t('profile.website')

// House glyphs on a 24 px grid, drawn with the stroke of the text (not the networks' official logos)
const ICONS: Record<keyof typeof NAMES, string> = {
  twitch: 'M5 3h15v11l-4 4h-4l-3 3v-3H5Z M11 8v4 M15 8v4',
  youtube: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z M10 9v6l5-3Z',
  x: 'M5 4l14 16 M19 4L5 20',
  bluesky: 'M12 11C9 6 5 4 4 5s0 6 3 7c-3 1-3 4 0 5s4-2 5-4c1 2 2 5 5 4s3-4 0-5c3-1 4-6 3-7s-5 1-8 6Z',
  instagram:
    'M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M17 7h0',
  tiktok: 'M14 3v12a4 4 0 1 1-4-4 M14 3c0 3 2 5 5 5',
  reddit: 'M4 14a8 5 0 1 0 16 0a8 5 0 1 0-16 0 M12 9l1-5 4 1 M9 14h0 M15 14h0 M9 17c2 1 4 1 6 0',
  discord: 'M6 6c4-2 8-2 12 0l2 11c-2 2-4 2-5 2l-1-2c-1 0-3 0-4 0l-1 2c-1 0-3 0-5-2Z M9 12h0 M15 12h0',
  website: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
}

async function copy(handle: string) {
  await navigator.clipboard.writeText(handle)
  copied.value = true
}
</script>

<template>
  <div v-if="links.length" class="socials">
    <ul class="list">
      <li v-for="link in links" :key="link.platform">
        <a
          v-if="link.url"
          class="link"
          :href="link.url"
          rel="nofollow ugc noopener noreferrer"
          target="_blank"
          :aria-label="`${name(link.platform)}: ${link.label}`"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[link.platform]" /></svg>
          <span class="label">{{ link.label }}</span>
        </a>
        <button
          v-else
          type="button"
          class="link"
          :aria-label="t('profile.copyDiscord', { handle: link.label })"
          @click="copy(link.label)"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[link.platform]" /></svg>
          <span class="label">{{ link.label }}</span>
        </button>
      </li>
    </ul>
    <p class="copied" role="status">{{ copied ? t('profile.discordCopied') : '' }}</p>
  </div>
</template>

<style scoped>
.socials {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-md);
  max-width: 100%;
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-soft);
  font: inherit;
  font-size: var(--text-sm);
  text-decoration: none;
  cursor: pointer;
}

.link:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copied {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.copied:empty {
  display: none;
}
</style>
