<script setup lang="ts">
// Site footer (Footer mockup): legal links. "Report a bug" (T-60) and the language switch (T-07b) come with their
// task; the ad slot and "Support the site" with their flag (v1.x).
// shortcut: English texts, moved to i18n in T-07b
const links = [
  { to: '/legal', label: 'Legal notice' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/cookies', label: 'Cookie settings' },
]
</script>

<template>
  <footer class="footer">
    <nav aria-label="Footer" class="links">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="link">{{ link.label }}</NuxtLink>
    </nav>
    <p class="brand">© Legendary Shots</p>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-6) max(var(--space-4), env(safe-area-inset-right)) var(--space-6)
    max(var(--space-4), env(safe-area-inset-left));
  border-top: var(--border-width) solid var(--color-border-subtle);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.links {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--space-4);
}

.link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-md);
  min-height: var(--control-md);
  color: inherit;
  text-decoration: none;
}

.link:hover {
  color: var(--color-text);
  text-decoration: underline;
}
</style>
