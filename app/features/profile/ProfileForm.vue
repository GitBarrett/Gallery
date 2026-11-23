<script setup lang="ts">
// Bio and language in the settings (US-07.1): saved at once, the profile shows the new bio and the site switches to
// the chosen language. The bio rules are checked as the member types, then by the server.
import { validateBio } from '~~/shared/domain/account-rules'
import { api, ApiError, errorMessageKey } from '~/services/api'

const props = defineProps<{ username: string; bio: string | null }>()

const { t, locale, locales, setLocale } = useI18n()
const bio = ref(props.bio ?? '')
const language = ref(locale.value)
const saved = ref(false)
const error = ref<string>()
const sending = ref(false)

const problem = computed(() => {
  const valid = validateBio(bio.value)
  return valid.ok ? undefined : t(`settings.profile.bio.${valid.error}`)
})
watch([bio, language], () => (saved.value = false))

async function submit() {
  if (problem.value) return
  sending.value = true
  error.value = undefined
  try {
    await api.updateMe({ bio: bio.value, locale: language.value })
    await refreshNuxtData(`profile:${props.username.toLowerCase()}`)
    if (language.value !== locale.value) await setLocale(language.value)
    saved.value = true
  } catch (thrown) {
    error.value =
      thrown instanceof ApiError && thrown.details?.reason === 'insult'
        ? t('settings.profile.bio.insult')
        : t(errorMessageKey(thrown))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="profile-form" aria-labelledby="profile-form-title">
    <h2 id="profile-form-title" class="title">{{ t('settings.profile.title') }}</h2>
    <form class="form" novalidate @submit.prevent="submit">
      <UiInput
        v-model="bio"
        multiline
        rows="4"
        :label="t('settings.profile.bio.label')"
        :hint="t('settings.profile.bio.hint', { count: [...bio.trim()].length })"
        :error="problem"
      />
      <fieldset class="languages">
        <legend class="legend">{{ t('settings.profile.language') }}</legend>
        <label v-for="option in locales" :key="option.code" class="option" :lang="option.language">
          <input v-model="language" type="radio" name="language" :value="option.code" class="radio" />
          {{ option.name }}
        </label>
      </fieldset>
      <UiButton type="submit" :disabled="sending || Boolean(problem)">{{ t('settings.profile.submit') }}</UiButton>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="saved" class="saved" role="status">{{ t('settings.profile.saved') }}</p>
    </form>
  </section>
</template>

<style scoped>
.profile-form,
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

.languages {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  border: 0;
}

.legend {
  margin-bottom: var(--space-1-5);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.option {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-md);
  cursor: pointer;
}

.radio {
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: var(--color-accent);
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
