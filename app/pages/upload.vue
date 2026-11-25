<script setup lang="ts">
// Upload (/upload, Upload mockup, US-10, US-11). A visitor is sent to sign in and comes back here (Q49); an unverified
// member sees why posting is blocked and how to verify (US-08.1). Network only for the service worker.
import UploadForm from '~/features/upload/UploadForm.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('upload.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
</script>

<template>
  <UploadForm v-if="me?.emailVerified" />
  <section v-else-if="me" class="verify" role="alert" aria-labelledby="upload-verify">
    <h1 id="upload-verify" class="title">{{ t('auth.verify.title') }}</h1>
    <p class="text">{{ t('upload.verify') }}</p>
    <UiButton :to="localePath('/verify-email')">{{ t('upload.verifyResend') }}</UiButton>
  </section>
</template>

<style scoped>
.verify {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.text {
  margin: 0;
  color: var(--color-text-soft);
}
</style>
