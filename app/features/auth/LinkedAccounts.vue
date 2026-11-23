<script setup lang="ts">
// Linked accounts in the settings (US-07.4), no mockup: design system only. Each provider says whether it is linked;
// a linked one can be unlinked unless it is the last way to sign in. Linking happens at sign-in (US-02.3).
import type { AccountResponse } from '~~/shared/contracts/auth'
import { api, ApiError, errorMessageKey } from '~/services/api'

type Provider = AccountResponse['providers'][number]
const PROVIDERS: Provider[] = ['google', 'battlenet']

const { t } = useI18n()
const providers = ref<Provider[]>()
const error = ref<string>()
const unlinked = ref<Provider>()
const sending = ref(false)

onMounted(async () => {
  try {
    providers.value = (await api.account()).providers
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
})

async function unlink(provider: Provider) {
  sending.value = true
  error.value = unlinked.value = undefined
  try {
    await api.unlinkOAuth(provider)
    providers.value = providers.value?.filter((p) => p !== provider)
    unlinked.value = provider
  } catch (thrown) {
    const last = thrown instanceof ApiError && thrown.details?.reason === 'last_sign_in_method'
    error.value = last ? t('settings.linked.last') : t(errorMessageKey(thrown))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="linked" aria-labelledby="linked-title">
    <h2 id="linked-title" class="title">{{ t('settings.linked.title') }}</h2>
    <ul v-if="providers" class="list">
      <li v-for="provider in PROVIDERS" :key="provider" class="provider">
        <span class="name">{{ t(`settings.linked.${provider}`) }}</span>
        <UiButton
          v-if="providers.includes(provider)"
          variant="ghost"
          :disabled="sending"
          :aria-label="t('settings.linked.unlinkLabel', { provider: t(`settings.linked.${provider}`) })"
          @click="unlink(provider)"
        >
          {{ t('settings.linked.unlink') }}
        </UiButton>
        <span v-else class="state">{{ t('settings.linked.none') }}</span>
      </li>
    </ul>
    <p v-if="unlinked" class="saved" role="status">
      {{ t('settings.linked.done', { provider: t(`settings.linked.${unlinked}`) }) }}
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.linked {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.provider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-md);
}

.name {
  font-weight: var(--weight-semibold);
}

.state,
.saved {
  margin: 0;
  color: var(--color-text-soft);
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
