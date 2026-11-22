<script setup lang="ts">
// "I am at least 15 and accept the Terms and Privacy policy" (US-01.7, US-02.1), required by both account forms.
const accepted = defineModel<boolean>({ default: false })
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <label class="terms">
    <input v-model="accepted" type="checkbox" required class="checkbox" />
    <span>{{ t('auth.signup.terms') }}</span>
  </label>
  <p class="policies">
    <NuxtLink :to="localePath('/terms')" class="link">{{ t('auth.signup.termsLink') }}</NuxtLink>
    <NuxtLink :to="localePath('/privacy')" class="link">{{ t('auth.signup.privacyLink') }}</NuxtLink>
  </p>
</template>

<style scoped>
.terms {
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
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-4);
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
</style>
