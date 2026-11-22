<script setup lang="ts">
import AuthCard from '~/features/auth/AuthCard.vue'
import OAuthComplete from '~/features/auth/OAuthComplete.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.oauth.completeTitle') })
</script>

<template>
  <AuthCard aria-labelledby="oauth-title">
    <OAuthComplete />
  </AuthCard>
</template>
