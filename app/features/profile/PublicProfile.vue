<script setup lang="ts">
// Public profile (US-05.3, Profile mockup): avatar, username, bio, membership date, then the captures. The avatar is
// the initial until avatars come (T-17a); statistics and the Follow / Share buttons come with the photos and follows
// (every counter is under 10 until then, hidden: US-70). The member's own profile leads to the settings (sign-out).
import type { ProfileResponse } from '~~/shared/contracts/auth'

const props = defineProps<{ profile: ProfileResponse; own: boolean }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const since = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(props.profile.memberSince),
  ),
)
</script>

<template>
  <div class="profile">
    <div class="banner" aria-hidden="true"></div>
    <section class="identity" aria-labelledby="profile-name">
      <div class="avatar" aria-hidden="true">{{ profile.username.charAt(0).toUpperCase() }}</div>
      <div class="about">
        <h1 id="profile-name" class="name">{{ profile.username }}</h1>
        <p v-if="profile.bio" class="bio">{{ profile.bio }}</p>
        <p class="since">{{ t('profile.memberSince', { date: since }) }}</p>
      </div>
      <UiButton v-if="own" :to="localePath('/settings')" variant="secondary">{{ t('profile.settings') }}</UiButton>
    </section>
    <section class="captures" aria-labelledby="profile-captures">
      <h2 id="profile-captures" class="section-title">{{ t('profile.captures') }}</h2>
      <UiEmptyState
        :title="own ? t('profile.emptyOwn') : t('profile.empty')"
        :description="own ? t('profile.emptyOwnText') : undefined"
        :heading-level="3"
      />
    </section>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-bottom: var(--space-8);
}

.banner {
  height: 160px;
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-raised) 100%);
}

.identity {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
  align-items: flex-end;
  margin-top: calc(-1 * var(--space-8) - var(--space-6));
  padding: 0 var(--space-4);
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  border: 3px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
}

.about {
  display: flex;
  flex: 1 1 240px;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  overflow-wrap: anywhere;
}

.bio {
  margin: 0;
  color: var(--color-text-soft);
  overflow-wrap: anywhere;
}

.since {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.captures {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-4);
}

.section-title {
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  font-family: var(--font-display);
  font-size: var(--text-xl);
}
</style>
