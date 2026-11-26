<script setup lang="ts">
// Search field (US-21.3): from 2 characters, the zones of the dictionary (in the visitor's language) and the tags that
// match are suggested in a list (combobox pattern: arrows, Enter, Escape); a suggestion or Enter runs the search.
import { api } from '~/services/api'

type Suggestion = { id: string; kind: 'zone' | 'tag'; label: string }

const props = defineProps<{ query: string }>()
const emit = defineEmits<{ search: [text: string] }>()
const { t, locale } = useI18n()
const id = useId()
const text = ref(props.query)
watch(
  () => props.query,
  (query) => (text.value = query),
)
const suggestions = ref<Suggestion[]>([])
const open = ref(false)
const active = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
let asked = 0

async function suggest(typed: string) {
  const turn = ++asked
  const [zones, tags] = await Promise.all([
    api.suggestZones(typed).catch(() => ({ zones: [] })),
    api.suggestTags(typed).catch(() => ({ tags: [] })),
  ])
  if (turn !== asked) return // a later text was typed meanwhile
  suggestions.value = [
    ...zones.zones.slice(0, 5).map((z) => ({
      id: `zone-${z.slug}`,
      kind: 'zone' as const,
      label: locale.value === 'fr' ? z.nameFr : z.nameEn,
    })),
    ...tags.tags.slice(0, 5).map((tag) => ({ id: `tag-${tag}`, kind: 'tag' as const, label: tag })),
  ]
  active.value = -1
  open.value = suggestions.value.length > 0
}

function typed() {
  clearTimeout(timer)
  const value = text.value.trim()
  if (value.length < 2) {
    asked++
    open.value = false
    return
  }
  timer = setTimeout(() => suggest(value), 150)
}

function run(value: string) {
  clearTimeout(timer)
  asked++
  open.value = false
  text.value = value
  emit('search', value)
}

function move(step: number) {
  if (!suggestions.value.length) return
  open.value = true
  const count = suggestions.value.length
  active.value = (active.value + step + count) % count
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Escape') {
    open.value = false
  }
}

function submit() {
  const chosen = open.value ? suggestions.value[active.value] : undefined
  run(chosen ? chosen.label : text.value)
}
const activeId = computed(() =>
  open.value && suggestions.value[active.value] ? `${id}-${suggestions.value[active.value]!.id}` : undefined,
)
</script>

<template>
  <form class="box" role="search" @submit.prevent="submit">
    <label :for="id" class="visually-hidden">{{ t('layout.search') }}</label>
    <input
      :id="id"
      v-model="text"
      type="search"
      name="q"
      class="input"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="activeId"
      :placeholder="t('layout.searchPlaceholder')"
      @input="typed"
      @keydown="onKey"
      @blur="open = false"
    />
    <UiButton type="submit">{{ t('search.submit') }}</UiButton>
    <ul v-show="open" :id="`${id}-list`" class="list" role="listbox" :aria-label="t('search.suggestions')">
      <li
        v-for="(suggestion, index) in suggestions"
        :id="`${id}-${suggestion.id}`"
        :key="suggestion.id"
        class="option"
        role="option"
        :aria-selected="index === active"
        @mousedown.prevent="run(suggestion.label)"
      >
        <span>{{ suggestion.kind === 'tag' ? `#${suggestion.label}` : suggestion.label }}</span>
        <span class="kind">{{ t(`search.kinds.${suggestion.kind}`) }}</span>
      </li>
    </ul>
  </form>
</template>

<style scoped>
.box {
  position: relative;
  display: flex;
  gap: var(--space-2);
}

.input {
  flex: 1;
  min-width: 0;
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.input:focus-visible {
  box-shadow: var(--focus-ring);
}

.list {
  position: absolute;
  z-index: var(--z-dropdown);
  top: 100%;
  right: 0;
  left: 0;
  margin: var(--space-1) 0 0;
  padding: var(--space-1) 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  list-style: none;
}

.option {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  cursor: pointer;
}

.option[aria-selected='true'],
.option:hover {
  background: var(--color-surface);
}

.kind {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}
</style>
