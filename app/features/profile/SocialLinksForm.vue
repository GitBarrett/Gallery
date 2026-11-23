<script setup lang="ts">
// Social networks in the settings (US-82.1–3), no mockup: design system only. One field per network in the fixed
// order, the identifier only (a full https URL for the website); an empty field removes the network. The rules are
// checked as the member types, then by the server, which may hide the links on the profile (US-82.5).
import { SOCIAL_PLATFORMS, validateSocialHandle, type SocialPlatform } from '~~/shared/domain/social-links'
import { api, ApiError, errorMessageKey } from '~/services/api'
import { SOCIAL_NAMES } from './social-names'

const props = defineProps<{ username: string }>()

const { t } = useI18n()
const handles = reactive(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, ''])) as Record<SocialPlatform, string>)
const serverError = ref<{ platform: SocialPlatform; reason: string }>()
const error = ref<string>()
const saved = ref(false)
const sending = ref(false)

const name = (platform: SocialPlatform) => (platform === 'website' ? t('profile.website') : SOCIAL_NAMES[platform])
const filled = () =>
  SOCIAL_PLATFORMS.flatMap((platform) => {
    const handle = handles[platform].trim()
    return handle ? [{ platform, handle }] : []
  })
const problems = computed(
  () =>
    Object.fromEntries(
      filled().flatMap(({ platform, handle }) => {
        const valid = validateSocialHandle(platform, handle)
        return valid.ok ? [] : [[platform, valid.error]]
      }),
    ) as Partial<Record<SocialPlatform, string>>,
)
function problemOf(platform: SocialPlatform) {
  const server = serverError.value?.platform === platform ? serverError.value.reason : undefined
  const reason = problems.value[platform] ?? server
  if (!reason) return undefined
  const key = reason === 'insult' ? 'insult' : platform === 'website' ? 'website' : 'format'
  return t(`settings.social.${key}`, { network: name(platform) })
}
watch(handles, () => {
  saved.value = false
  serverError.value = undefined
})

onMounted(async () => {
  try {
    for (const { platform, handle } of (await api.socialLinks()).links) handles[platform] = handle
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
})

async function submit() {
  if (Object.keys(problems.value).length) return
  sending.value = true
  error.value = undefined
  try {
    await api.setSocialLinks({ links: filled() })
    await refreshNuxtData(`profile:${props.username.toLowerCase()}`)
    saved.value = true
  } catch (thrown) {
    const details = thrown instanceof ApiError ? thrown.details : undefined
    if (details?.field && (SOCIAL_PLATFORMS as readonly string[]).includes(details.field))
      serverError.value = { platform: details.field as SocialPlatform, reason: String(details.reason) }
    else error.value = t(errorMessageKey(thrown))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="social-form" aria-labelledby="social-form-title">
    <h2 id="social-form-title" class="title">{{ t('settings.social.title') }}</h2>
    <p class="text">{{ t('settings.social.text') }}</p>
    <form class="form" novalidate @submit.prevent="submit">
      <UiInput
        v-for="platform in SOCIAL_PLATFORMS"
        :key="platform"
        v-model="handles[platform]"
        :label="name(platform)"
        :type="platform === 'website' ? 'url' : 'text'"
        maxlength="200"
        autocomplete="off"
        spellcheck="false"
        :error="problemOf(platform)"
      />
      <UiButton type="submit" :disabled="sending || Object.keys(problems).length > 0">
        {{ t('settings.social.submit') }}
      </UiButton>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="saved" class="saved" role="status">{{ t('settings.social.saved') }}</p>
    </form>
  </section>
</template>

<style scoped>
.social-form,
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form {
  align-items: flex-start;
}

.form > :deep(.field) {
  align-self: stretch;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.text {
  margin: 0;
  color: var(--color-text-soft);
}

.error {
  margin: 0;
  color: var(--color-danger);
}

.saved {
  margin: 0;
  color: var(--color-text-soft);
}
</style>
