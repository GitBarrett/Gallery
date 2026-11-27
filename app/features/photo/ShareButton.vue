<script setup lang="ts">
// Share of the photo page (US-32.1): the native share sheet when the browser has one (mobiles), otherwise a menu:
// copy the link, X, Facebook, Reddit, Discord (no share URL: the link is copied to paste there). Each share sends
// `photo_shared` with its way, after the analytics consent only (US-32.3, US-72.1). The link is the canonical one,
// whose preview shows the 1200 px image, the title and the author (US-32.2, US-25.1).
const props = defineProps<{ photoId: string; title: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const track = useAnalytics()
const id = useId()
const url = `${useRequestURL().origin}${localePath(`/p/${props.photoId}`)}`
const open = ref(false)
const copied = ref(false)

const encoded = encodeURIComponent(url)
const text = encodeURIComponent(props.title)
const NETWORKS = [
  { name: 'X', href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}` },
  { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
  { name: 'Reddit', href: `https://www.reddit.com/submit?url=${encoded}&title=${text}` },
]

async function share() {
  if (navigator.share) {
    try {
      await navigator.share({ title: props.title, url })
      track('photo_shared', { method: 'native' })
    } catch {
      // closed by the member: nothing shared
    }
    return
  }
  open.value = !open.value
}

async function copy(method: 'copy' | 'discord') {
  await navigator.clipboard.writeText(url).catch(() => {})
  copied.value = true
  track('photo_shared', { method })
}
</script>

<template>
  <div class="share">
    <UiButton variant="secondary" :aria-expanded="open" :aria-controls="`${id}-menu`" @click="share">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" />
      </svg>
      {{ t('photo.share.label') }}
    </UiButton>
    <ul v-show="open" :id="`${id}-menu`" class="menu">
      <li>
        <UiButton variant="ghost" block @click="copy('copy')">{{ t('photo.share.copy') }}</UiButton>
      </li>
      <li v-for="network in NETWORKS" :key="network.name">
        <a
          :href="network.href"
          target="_blank"
          rel="noopener noreferrer"
          class="link"
          @click="track('photo_shared', { method: network.name.toLowerCase() })"
        >
          {{ network.name }}
        </a>
      </li>
      <li>
        <UiButton variant="ghost" block @click="copy('discord')">{{ t('photo.share.discord') }}</UiButton>
      </li>
    </ul>
    <p v-if="copied" class="copied" role="status">{{ t('photo.share.copied') }}</p>
  </div>
</template>

<style scoped>
.share {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.icon {
  width: var(--space-4);
  height: var(--space-4);
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.menu {
  display: flex;
  flex-direction: column;
  min-width: 12rem;
  margin: 0;
  padding: var(--space-1);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  list-style: none;
}

/* US-67.5: a touch target of 44 px */
.link {
  display: flex;
  align-items: center;
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  color: var(--color-text);
}

.link:focus-visible {
  box-shadow: var(--focus-ring);
}

.copied {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
</style>
