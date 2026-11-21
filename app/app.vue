<script setup lang="ts">
// Cloudflare Web Analytics (ADR-006) : balise ajoutée par Nuxt pour porter le nonce CSP ; l'injection automatique
// de Cloudflare est désactivée (08-securite.md § 5). Sans jeton (local, tests), pas de beacon.
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
  <NuxtPage />
</template>
