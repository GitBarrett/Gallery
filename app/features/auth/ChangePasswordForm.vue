<script setup lang="ts">
// Password change in the settings (US-07.3), no mockup: design system only. The old password proves the owner; once
// changed, every other device is signed out and the device list shows it.
import { api, ApiError, errorMessageKey } from '~/services/api'
import { signupError } from './signup-errors'

const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const currentPassword = ref('')
const password = ref('')
const errors = ref<{ current?: string; password?: string; form?: string }>({})
const saved = ref(false)
const sending = ref(false)

async function submit() {
  sending.value = true
  errors.value = {}
  saved.value = false
  try {
    await api.changePassword({ currentPassword: currentPassword.value, password: password.value })
    currentPassword.value = password.value = ''
    saved.value = true
    emit('changed')
  } catch (thrown) {
    if (thrown instanceof ApiError && thrown.details?.field === 'currentPassword')
      errors.value = { current: t(`settings.password.${thrown.details.reason === 'none' ? 'none' : 'wrong'}`) }
    else {
      const refused = signupError(thrown)
      const key = refused === 'invite_required' ? errorMessageKey(thrown) : refused.key
      errors.value =
        refused !== 'invite_required' && refused.field === 'password' ? { password: t(key) } : { form: t(key) }
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="password-form" aria-labelledby="password-form-title">
    <h2 id="password-form-title" class="title">{{ t('settings.password.title') }}</h2>
    <form class="form" @submit.prevent="submit">
      <UiInput
        v-model="currentPassword"
        :label="t('settings.password.current')"
        type="password"
        required
        autocomplete="current-password"
        maxlength="512"
        :error="errors.current"
      />
      <UiInput
        v-model="password"
        :label="t('settings.password.new')"
        type="password"
        required
        autocomplete="new-password"
        maxlength="512"
        :hint="t('auth.signup.passwordHint')"
        :error="errors.password"
      />
      <UiButton type="submit" :disabled="sending">{{ t('settings.password.submit') }}</UiButton>
      <p v-if="errors.form" class="error" role="alert">{{ errors.form }}</p>
      <p v-if="saved" class="saved" role="status">{{ t('settings.password.saved') }}</p>
    </form>
  </section>
</template>

<style scoped>
.password-form,
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

.error {
  margin: 0;
  color: var(--color-danger);
}

.saved {
  margin: 0;
  color: var(--color-text-soft);
}
</style>
