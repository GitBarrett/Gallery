<script setup lang="ts">
// Username change in the settings (US-05.1, US-05.2, US-05.4). The rules are checked as the member types, then the
// server says if the name is free (US-05.2, < 500 ms); once every 30 days, the former link redirects for 90 days.
import { validateUsername } from '~~/shared/domain/account-rules'
import { api, ApiError, errorMessageKey } from '~/services/api'

const props = defineProps<{ username: string }>()

const { t } = useI18n()
const name = ref(props.username)
const problem = ref<string>()
const free = ref(false)
const error = ref<string>()
const saved = ref(false)
const sending = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const unchanged = computed(() => name.value === props.username)

watch(name, (value) => {
  clearTimeout(timer)
  free.value = false
  saved.value = false
  error.value = undefined
  const valid = validateUsername(value)
  problem.value = valid.ok || unchanged.value ? undefined : `auth.errors.username.${valid.error}`
  if (!valid.ok || unchanged.value) return
  // shortcut: lowercase compare only; the case of one's own name is a change the server accepts
  if (value.toLowerCase() === props.username.toLowerCase()) return void (free.value = true)
  timer = setTimeout(async () => {
    const answer = await api.usernameAvailability(value).catch(() => undefined)
    if (name.value !== value || !answer) return
    if (answer.available) free.value = true
    else problem.value = `auth.errors.username.${answer.reason}`
  }, 250)
})

function messageOf(thrown: unknown) {
  if (
    thrown instanceof ApiError &&
    thrown.code === 'RATE_LIMITED' &&
    typeof thrown.details?.retryAfterSeconds === 'number'
  )
    return t('settings.username.wait', { days: Math.ceil(thrown.details.retryAfterSeconds / 86_400) })
  if (thrown instanceof ApiError && thrown.code === 'CONFLICT') return t('auth.errors.username.taken')
  return t(errorMessageKey(thrown))
}

async function submit() {
  if (problem.value || unchanged.value) return
  sending.value = true
  error.value = undefined
  try {
    await api.updateMe({ username: name.value })
    saved.value = true
    free.value = false
    await refreshNuxtData('me')
  } catch (thrown) {
    error.value = messageOf(thrown)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="username" aria-labelledby="username-title">
    <h2 id="username-title" class="title">{{ t('settings.username.title') }}</h2>
    <form class="form" novalidate @submit.prevent="submit">
      <UiInput
        v-model="name"
        :label="t('auth.signup.username')"
        :hint="free ? t('settings.username.free', { name }) : t('settings.username.hint')"
        :error="problem ? t(problem) : undefined"
        autocomplete="username"
        maxlength="24"
        required
      />
      <UiButton type="submit" :disabled="sending || unchanged || Boolean(problem)">
        {{ t('settings.username.submit') }}
      </UiButton>
    </form>
    <p v-if="saved" class="saved" role="status">{{ t('settings.username.saved') }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.username {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.form > :first-child {
  align-self: stretch;
}

.saved,
.error {
  margin: 0;
}

.saved {
  color: var(--color-success);
}

.error {
  color: var(--color-danger);
}
</style>
