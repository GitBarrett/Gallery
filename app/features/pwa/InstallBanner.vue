<script setup lang="ts">
// Discreet install invitation (US-63.2–4, 07-design.md § Invitation à l'installation). Chrome: kept
// `beforeinstallprompt`, then the browser dialog. Safari iOS (no such event): a sheet "Share → Add to Home Screen".
// Visits and the dismissal date live in this browser only (localStorage: a per-viewer convenience).
import { shouldOfferInstall } from './install-rules'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

const VISITS = 'ls-visits'
const DISMISSED = 'ls-install-dismissed'
const { t } = useI18n()
const available = ref<'chrome' | 'ios' | null>(null)
const offered = ref(false)
const sheetOpen = ref(false)
let deferred: InstallPromptEvent | undefined

// Storage can be blocked (private mode): the invitation then simply never shows
function read(key: string) {
  try {
    return Number(localStorage.getItem(key) ?? 0)
  } catch {
    return 0
  }
}
function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignored, see read()
  }
}

function countVisit() {
  try {
    if (sessionStorage.getItem(VISITS)) return
    sessionStorage.setItem(VISITS, '1')
    write(VISITS, read(VISITS) + 1)
  } catch {
    // ignored, see read()
  }
}

function onPrompt(event: Event) {
  event.preventDefault()
  deferred = event as InstallPromptEvent
  available.value = 'chrome'
}

onMounted(() => {
  countVisit()
  const dismissedAt = read(DISMISSED) || undefined
  // shortcut: `published` stays false until captures can be published (T-26a)
  offered.value = shouldOfferInstall({ visits: read(VISITS), published: false, dismissedAt, now: Date.now() })
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) available.value = 'ios'
  window.addEventListener('beforeinstallprompt', onPrompt)
})
onBeforeUnmount(() => window.removeEventListener('beforeinstallprompt', onPrompt))

async function install() {
  if (available.value === 'ios') return (sheetOpen.value = true)
  await deferred?.prompt()
  available.value = null
}

function dismiss() {
  write(DISMISSED, Date.now())
  offered.value = false
}
</script>

<template>
  <section v-if="offered && available" :aria-label="t('pwa.installApp')" class="banner">
    <p class="text">{{ t('pwa.installText') }}</p>
    <div class="actions">
      <UiButton @click="install">{{ available === 'ios' ? t('pwa.installApp') : t('pwa.install') }}</UiButton>
      <UiButton variant="ghost" @click="dismiss">{{ t('pwa.notNow') }}</UiButton>
    </div>
    <UiBottomSheet v-model:open="sheetOpen" :title="t('pwa.iosTitle')" :close-label="t('pwa.dismiss')">
      <p>{{ t('pwa.iosSteps') }}</p>
    </UiBottomSheet>
  </section>
</template>

<style scoped>
.banner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-3) max(var(--space-4), env(safe-area-inset-right)) var(--space-3)
    max(var(--space-4), env(safe-area-inset-left));
  border-top: var(--border-width) solid var(--color-border-subtle);
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  gap: var(--space-2);
}
</style>
