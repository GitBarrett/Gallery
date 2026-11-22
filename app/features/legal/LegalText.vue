<script setup lang="ts">
// Inline text of a legal page: plain, bold or italic runs, always rendered as text.
import type { Inline } from './legal'

defineProps<{ content: Inline[] }>()
</script>

<template>
  <template v-for="(part, i) in content" :key="i">
    <strong v-if="part.strong">{{ part.text }}</strong>
    <em v-else-if="part.em">{{ part.text }}</em>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
