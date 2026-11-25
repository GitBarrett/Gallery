<script setup lang="ts">
// « Explore » of the header and the tab bar (07-design.md § Header): the PLP of the first game version of the
// catalogue (Q83), until a page of its own exists.
import { useGameVersions } from '~/features/gallery/useGameVersions'

const first = (await useGameVersions()).value[0]
if (!first) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
await navigateTo(useLocalePath()(`/v/${first.slug}`), { redirectCode: 302, replace: true })
</script>

<template>
  <div></div>
</template>
