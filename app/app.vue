<script setup lang="ts">
// Cloudflare Web Analytics (ADR-006): tag added by Nuxt so that it carries the CSP nonce; Cloudflare automatic
// injection is disabled (08-securite.md § 5). Without a token (local, tests), no beacon.
const { locale } = useI18n()
useHead({ htmlAttrs: { lang: locale } })
const { cfBeaconToken } = useRuntimeConfig().public
if (cfBeaconToken)
  useHead({
    script: [
      {
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        defer: true,
        'data-cf-beacon': JSON.stringify({ token: cfBeaconToken }),
      },
    ],
  })
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
