<script setup lang="ts">
// Email change in the settings (US-07.2), no mockup: design system only. The current password is asked when the
// account has one; the email changes only once the link sent to the new address is opened (/confirm-email).
import type { AccountResponse } from '~~/shared/contracts/auth'
import { api, ApiError, errorMessageKey } from '~/services/api'

const { t } = useI18n()
const account = ref<AccountResponse>()
const newEmail = ref('')
const currentPassword = ref('')
const errors = ref<{ email?: string; password?: string; form?: string }>({})
const sentTo = ref<string>()
const sending = ref(false)

onMounted(async () => {
  try {
    account.value = await api.account()
  } catch (thrown) {
    errors.value = { form: t(errorMessageKey(thrown)) }
  }
})

async function submit() {
  sending.value = true
  errors.value = {}
  sentTo.value = undefined
  try {
    const password = account.value?.hasPassword ? { currentPassword: currentPassword.value } : {}
    await api.changeEmail({ newEmail: newEmail.value, ...password })
    sentTo.value = newEmail.value
    newEmail.value = currentPassword.value = ''
  } catch (thrown) {
    const details = thrown instanceof ApiError ? thrown.details : undefined
    if (details?.field === 'currentPassword') errors.value = { password: t('settings.password.wrong') }
    else if (details?.field === 'newEmail') errors.value = { email: t('settings.email.same') }
    else errors.value = { form: t(errorMessageKey(thrown)) }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="email-form" aria-labelledby="email-form-title">
    <h2 id="email-form-title" class="title">{{ t('settings.email.title') }}</h2>
    <p v-if="account" class="text">
      {{ account.email ? t('settings.email.current', { email: account.email }) : t('settings.email.none') }}
    </p>
    <form v-if="account" class="form" @submit.prevent="submit">
      <UiInput
        v-model="newEmail"
        :label="t('settings.email.new')"
        type="email"
        required
        autocomplete="email"
        maxlength="254"
        :error="errors.email"
      />
      <UiInput
        v-if="account.hasPassword"
        v-model="currentPassword"
        :label="t('settings.password.current')"
        type="password"
        required
        autocomplete="current-password"
        maxlength="512"
        :error="errors.password"
      />
      <UiButton type="submit" :disabled="sending">{{ t('settings.email.submit') }}</UiButton>
      <p v-if="sentTo" class="saved" role="status">{{ t('settings.email.sent', { email: sentTo }) }}</p>
    </form>
    <p v-if="errors.form" class="error" role="alert">{{ errors.form }}</p>
  </section>
</template>

<style scoped>
.email-form,
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

.text,
.saved {
  margin: 0;
  color: var(--color-text-soft);
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
