<script setup lang="ts">
// Anti-bot check of a form (08-securite.md § 2). `action` is the one the server verifies (signup, waitlist…).
// The token is single use: the form calls reset() after each attempt. Test site key locally and on previews.
import { loadTurnstile, type Turnstile } from './turnstile'

const props = defineProps<{ action: string }>()
const token = defineModel<string>({ default: '' })
const { t, locale } = useI18n()
const { turnstileSiteKey } = useRuntimeConfig().public
const box = ref<HTMLElement>()
const failed = ref(false)
let turnstile: Turnstile | undefined
let widgetId: string | undefined

onMounted(async () => {
  try {
    turnstile = await loadTurnstile()
  } catch {
    failed.value = true
    return
  }
  if (!box.value) return
  widgetId = turnstile.render(box.value, {
    sitekey: turnstileSiteKey,
    action: props.action,
    language: locale.value,
    theme: 'dark',
    callback: (value: string) => (token.value = value),
    'expired-callback': () => (token.value = ''),
    'error-callback': () => (token.value = ''),
  })
})

onBeforeUnmount(() => {
  if (widgetId) turnstile?.remove(widgetId)
})

defineExpose({
  reset() {
    token.value = ''
    if (widgetId) turnstile?.reset(widgetId)
  },
})
</script>

<template>
  <div ref="box" class="turnstile">
    <p v-if="failed" class="failed" role="alert">{{ t('auth.turnstileUnavailable') }}</p>
  </div>
</template>

<style scoped>
.turnstile {
  min-height: var(--turnstile-height); /* no layout shift when the widget appears */
}

.failed {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
