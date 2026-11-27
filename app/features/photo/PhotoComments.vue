<script setup lang="ts">
// Comments of the photo page (US-31, Photo mockup): « Comments · N », the form of a verified member (a visitor is
// invited to sign in, an unverified member to verify, US-08.1), then the comments, newest first, as plain text
// (US-31.1: no HTML nor Markdown, links not clickable). Its author edits a comment for 15 minutes (« edited »,
// US-31.3); its author or the capture's deletes it (US-31.4). A Turnstile check when the server asks (US-31.5).
import { canEditComment } from '~~/shared/domain/comments'
import TurnstileCheck from '~/features/auth/TurnstileCheck.vue'
import { useComments } from './useComments'

const props = defineProps<{ photoId: string; total: number; author: string }>()
const { t, locale } = useI18n()
const when = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const route = useRoute()
const localePath = useLocalePath()
const { me } = await useMe()
const comments = await useComments(props.photoId, props.total)
const { items, count, done, busy, turnstile, error } = comments
const id = useId()
const draft = ref('')
const token = ref('')
const editing = ref<string>()
const editText = ref('')

const same = (a: string, b?: string) => a.toLowerCase() === b?.toLowerCase()
const mine = (username: string) => same(username, me.value?.username)
const canDelete = (username: string) => mine(username) || same(props.author, me.value?.username)
const canEdit = (c: { author: { username: string }; createdAt: string }) =>
  mine(c.author.username) && canEditComment(new Date(c.createdAt), new Date())

async function submit() {
  if (await comments.post(draft.value, token.value || undefined)) draft.value = ''
  token.value = ''
}

async function save(commentId: string) {
  if (await comments.edit(commentId, editText.value)) editing.value = undefined
}

function startEdit(commentId: string, body: string) {
  editing.value = commentId
  editText.value = body
}
</script>

<template>
  <section class="comments" :aria-labelledby="`${id}-title`">
    <h2 :id="`${id}-title`" class="title">{{ t('comments.title', { count }) }}</h2>

    <form v-if="me?.emailVerified" class="form" @submit.prevent="submit">
      <label :for="`${id}-new`" class="visually-hidden">{{ t('comments.add') }}</label>
      <textarea
        :id="`${id}-new`"
        v-model="draft"
        rows="3"
        maxlength="1000"
        class="input"
        :placeholder="t('comments.placeholder')"
      ></textarea>
      <TurnstileCheck v-if="turnstile" v-model="token" action="comment" />
      <div class="row">
        <span class="hint">{{ t('comments.hint') }}</span>
        <UiButton type="submit" :disabled="busy || !draft.trim()">{{ t('comments.post') }}</UiButton>
      </div>
    </form>
    <p v-else-if="me" class="notice" role="status">
      {{ t('comments.verify') }}
      <NuxtLink :to="localePath('/verify-email')">{{ t('upload.verifyResend') }}</NuxtLink>
    </p>
    <p v-else class="notice">
      <NuxtLink :to="{ path: localePath('/signin'), query: { redirect: route.path } }">{{
        t('comments.signIn')
      }}</NuxtLink>
    </p>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>

    <p v-if="!items.length" class="empty">{{ t('comments.empty') }}</p>
    <ul v-else class="list">
      <li v-for="comment in items" :key="comment.id">
        <article class="comment">
          <UiAvatar :src="comment.author.avatarUrl" :name="comment.author.username" />
          <div class="content">
            <p class="meta">
              <NuxtLink :to="localePath(`/u/${comment.author.username}`)">{{ comment.author.username }}</NuxtLink>
              · <time :datetime="comment.createdAt">{{ when(comment.createdAt) }}</time>
              <span v-if="comment.editedAt"> · {{ t('comments.edited') }}</span>
            </p>
            <form v-if="editing === comment.id" class="form" @submit.prevent="save(comment.id)">
              <label :for="`${id}-${comment.id}`" class="visually-hidden">{{ t('comments.editLabel') }}</label>
              <textarea
                :id="`${id}-${comment.id}`"
                v-model="editText"
                rows="3"
                maxlength="1000"
                class="input"
              ></textarea>
              <div class="row">
                <UiButton variant="ghost" @click="editing = undefined">{{ t('comments.cancel') }}</UiButton>
                <UiButton type="submit" :disabled="busy">{{ t('comments.save') }}</UiButton>
              </div>
            </form>
            <p v-else class="body">{{ comment.body }}</p>
            <div v-if="editing !== comment.id && canDelete(comment.author.username)" class="row">
              <UiButton v-if="canEdit(comment)" variant="ghost" @click="startEdit(comment.id, comment.body)">
                {{ t('comments.edit') }}
              </UiButton>
              <UiButton variant="ghost" :disabled="busy" @click="comments.remove(comment.id)">
                {{ t('comments.delete') }}
              </UiButton>
            </div>
          </div>
        </article>
      </li>
    </ul>
    <UiButton v-if="!done" variant="secondary" :disabled="busy" @click="comments.loadMore">
      {{ t('comments.more') }}
    </UiButton>
  </section>
</template>

<style scoped>
.comments,
.list,
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  resize: vertical;
}

.input:focus-visible {
  box-shadow: var(--focus-ring);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.hint,
.meta,
.empty,
.notice {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* US-67.5: a touch target of 44 px */
.meta a,
.notice a {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.comment {
  display: flex;
  gap: var(--space-3);
}

.content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

/* US-31.1: the text as written, its line breaks kept, long words cut */
.body {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
