<script setup lang="ts">
// Horizontal logo (docs/design/LogoMark.dc.html): "legendary aperture" emblem and wordmark; the emblem alone
// on mobile. The brand name is never translated.
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="logo">
    <img src="/brand/emblem.svg" :alt="compact ? 'Legendary Shots' : ''" width="40" height="40" class="emblem" />
    <span v-if="!compact" class="wordmark">Legendary <span class="shots">Shots</span></span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  gap: var(--space-3);
  align-items: center;
  min-height: var(--control-md);
}

.wordmark {
  color: var(--color-logo-legendary);
  font-family: var(--font-logo);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-display);
  line-height: 1;
  text-shadow: var(--shadow-logo);
  white-space: nowrap;
}

.shots {
  color: var(--color-accent);
  font-family: var(--font-display);
  letter-spacing: var(--tracking-wide);
}
</style>
