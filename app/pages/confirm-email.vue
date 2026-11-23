<script setup lang="ts">
import AuthCard from '~/features/auth/AuthCard.vue'
import ConfirmEmail from '~/features/auth/ConfirmEmail.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.confirmEmail.title') })
</script>

<template>
  <AuthCard aria-labelledby="confirm-title">
    <ConfirmEmail />
  </AuthCard>
</template>
