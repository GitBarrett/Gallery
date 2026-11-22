<script setup lang="ts">
import AuthCard from '~/features/auth/AuthCard.vue'
import ResetPassword from '~/features/auth/ResetPassword.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.forgot.title') })
</script>

<template>
  <AuthCard aria-labelledby="reset-title">
    <ResetPassword />
  </AuthCard>
</template>
