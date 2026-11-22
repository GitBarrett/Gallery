<script setup lang="ts">
// Waiting list of the invite-only beta (US-56.4, Q43): shown when a sign-up is refused without invitation, the
// same way whatever the email. Consent to be emailed at the opening (privacy policy). No mockup: design system.
import { api } from '~/services/api'
import { signupError, type FormError } from './signup-errors'
import TurnstileCheck from './TurnstileCheck.vue'

const props = defineProps<{ email: string }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const email = ref(props.email)
const consent = ref(false)
const turnstileToken = ref('')
const turnstile = ref<InstanceType<typeof TurnstileCheck>>()
const error = ref<FormError>()
const sending = ref(false)
const done = ref(false)

async function submit() {
  sending.value = true
  error.value = undefined
  try {
    await api.waitlist({
      email: email.value,
      turnstileToken: turnstileToken.value,
      locale: locale.value === 'fr' ? 'fr' : 'en',
    })
    done.value = true
  } catch (thrown) {
    const refused = signupError(thrown)
    error.value = refused === 'invite_required' ? { key: 'errors.FORBIDDEN' } : refused
  } finally {
    sending.value = false
    turnstile.value?.reset()
  }
}
</script>

<template>
  <div v-if="done" role="status">
    <h1 id="signup-title" class="title">{{ t('auth.waitlist.doneTitle') }}</h1>
    <p class="text">{{ t('auth.waitlist.doneText') }}</p>
  </div>
  <form v-else class="form" @submit.prevent="submit">
    <h1 id="signup-title" class="title">{{ t('auth.waitlist.title') }}</h1>
    <p class="text" role="status">{{ t('auth.waitlist.text') }}</p>
    <UiInput
      v-model="email"
      :label="t('auth.signup.email')"
      type="email"
      required
      autocomplete="email"
      maxlength="254"
    />
    <label class="consent">
      <input v-model="consent" type="checkbox" required class="checkbox" />
      <span>{{ t('auth.waitlist.consent') }}</span>
    </label>
    <p class="policies">
      <NuxtLink :to="localePath('/privacy')" class="link">{{ t('auth.signup.privacyLink') }}</NuxtLink>
    </p>
    <TurnstileCheck ref="turnstile" v-model="turnstileToken" action="waitlist" />
    <p v-if="error" class="error" role="alert">{{ t(error.key) }}</p>
    <UiButton type="submit" size="lg" block :disabled="sending || !turnstileToken">
      {{ t('auth.waitlist.submit') }}
    </UiButton>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.text {
  margin: 0;
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}

.consent {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-height: var(--control-md);
  font-size: var(--text-sm);
  cursor: pointer;
}

.checkbox {
  flex: none;
  width: var(--space-5);
  height: var(--space-5);
  margin: 0;
  accent-color: var(--color-accent);
}

.policies {
  margin: 0;
  font-size: var(--text-sm);
}

.link {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  min-width: var(--control-md);
  justify-content: center;
  color: var(--color-accent);
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
