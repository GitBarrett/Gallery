<script setup lang="ts">
import SignupForm from '~/features/auth/SignupForm.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.signup.title') })
</script>

<template>
  <SignupForm />
</template>
