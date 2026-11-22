<script setup lang="ts">
import AuthCard from '~/features/auth/AuthCard.vue'
import SigninForm from '~/features/auth/SigninForm.vue'

const { t } = useI18n()
useHead({ title: () => t('auth.signin.title') })
</script>

<template>
  <AuthCard tab="signin" aria-labelledby="signin-title">
    <h1 id="signin-title" class="visually-hidden">{{ t('auth.signin.title') }}</h1>
    <SigninForm />
  </AuthCard>
</template>
