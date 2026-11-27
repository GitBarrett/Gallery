<script setup lang="ts">
// Like of the photo page (US-30, Photo mockup): pressed when the member likes the capture, its counter beside. The
// page is cached for everyone: the member's state is read once in the browser. Their own capture: disabled
// (US-30.2); a visitor is sent to sign in, back to the page (US-30.4).
import { shownCount } from '~~/shared/domain/counters'
import { api, errorMessageKey } from '~/services/api'

const props = defineProps<{ photoId: string; likes: number; author: string }>()
const { t, n } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { me } = await useMe()
const own = computed(() => me.value?.username.toLowerCase() === props.author.toLowerCase())
const liked = ref(false)
const count = ref(props.likes)
const busy = ref(false)
const error = ref<string>()

onMounted(async () => {
  if (!me.value || own.value) return
  const state = await api.likeState(props.photoId).catch(() => null)
  if (state) ({ liked: liked.value, likes: count.value } = state)
})

async function toggle() {
  if (!me.value) return void (await navigateTo({ path: localePath('/signin'), query: { redirect: route.path } }))
  if (busy.value) return
  busy.value = true
  error.value = undefined
  try {
    const state = await (liked.value ? api.unlike(props.photoId) : api.like(props.photoId))
    ;({ liked: liked.value, likes: count.value } = state)
  } catch (thrown) {
    error.value = errorMessageKey(thrown)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="like">
    <UiButton
      variant="secondary"
      class="button"
      :class="{ liked }"
      :aria-pressed="liked"
      :disabled="own || busy"
      :title="own ? t('photo.like.own') : undefined"
      @click="toggle"
    >
      <svg class="icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 27s-10-6-12.5-12A6.5 6.5 0 0 1 16 9a6.5 6.5 0 0 1 12.5 6C26 21 16 27 16 27Z" />
      </svg>
      {{ t('photo.like.label') }}
      <span v-if="shownCount(count)" class="count">{{ n(count) }}</span>
    </UiButton>
    <p v-if="own" class="hint">{{ t('photo.like.own') }}</p>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
  </div>
</template>

<style scoped>
.like {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.icon {
  width: var(--space-4);
  height: var(--space-4);
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.4;
}

.liked {
  border-color: var(--quality-legendary);
}

.liked .icon {
  fill: currentcolor;
}

.count {
  color: var(--color-text-muted);
}

.hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
