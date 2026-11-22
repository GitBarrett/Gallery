<script setup lang="ts">
// Error page (US-69, no mockup: composed with the design system). 404: the "uncharted zone" (US-79.1) with search,
// the Hearthstone back home and the reference; any other status: a generic message and the correlation id (cf-ray)
// to quote, never a technical detail. Nuxt sets the HTTP status.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError<{ correlationId?: string }> }>()
const { t } = useI18n()
const localePath = useLocalePath()

const notFound = computed(() => props.error.statusCode === 404)
// Id of the failed request, kept from the server render; an API error passed by a page (data) wins.
// shortcut: an error raised in the browser after navigation has no id, show Sentry's event id if support asks
const requestId = useState('error-correlation-id', () => useRequestEvent()?.context.correlationId as string | undefined)
const correlationId = computed(() => props.error.data?.correlationId ?? requestId.value)
const query = ref('')

useHead({ title: () => t(notFound.value ? 'errorPage.notFoundTitle' : 'errorPage.serverTitle') })
</script>

<template>
  <NuxtLayout>
    <UiEmptyState
      v-if="notFound"
      :heading-level="1"
      :title="t('errorPage.notFoundTitle')"
      :description="t('errorPage.notFoundText')"
    >
      <template #icon>
        <img src="/brand/uncharted-map.svg" alt="" width="160" height="120" />
      </template>
      <template #action>
        <form role="search" :action="localePath('/search')" method="get" class="search">
          <UiInput v-model="query" :label="t('errorPage.searchLabel')" type="search" name="q" />
          <UiButton type="submit" variant="secondary">{{ t('layout.search') }}</UiButton>
        </form>
        <p v-if="correlationId" class="reference">
          {{ t('errorPage.reference') }} <code data-testid="correlation-id">{{ correlationId }}</code>
        </p>
        <UiButton :to="localePath('/')">{{ t('errorPage.hearthstone') }}</UiButton>
      </template>
    </UiEmptyState>
    <UiEmptyState
      v-else
      :heading-level="1"
      :title="t('errorPage.serverTitle')"
      :description="t('errorPage.serverText')"
    >
      <template #action>
        <p v-if="correlationId" class="reference">
          {{ t('errorPage.reference') }} <code data-testid="correlation-id">{{ correlationId }}</code>
        </p>
        <UiButton :to="localePath('/')">{{ t('errorPage.home') }}</UiButton>
      </template>
    </UiEmptyState>
  </NuxtLayout>
</template>

<style scoped>
.search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-end;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.reference {
  margin-bottom: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
</style>
