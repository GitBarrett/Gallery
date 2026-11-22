<script setup lang="ts">
import AuthCard from '~/features/auth/AuthCard.vue'
import VerifyEmail from '~/features/auth/VerifyEmail.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.verify.title') })
</script>

<template>
  <AuthCard aria-labelledby="verify-title">
    <VerifyEmail />
  </AuthCard>
</template>
