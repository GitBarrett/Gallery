import type { ZoneSuggestResponse } from '~~/shared/contracts/catalog'
import { api } from '~/services/api'

type Zone = ZoneSuggestResponse['zones'][number]

/**
 * Zone field of the upload and edit forms (US-11.2, US-11.3): suggestions of the dictionary while the member types
 * (EN or FR names), then the text read as a zone of the dictionary when it is one of their names, else a free zone.
 * `known`: zones already named (the current zone of a capture being edited).
 */
export function useZoneSuggestions(text: Ref<string>, known: Ref<Zone[]> = ref([])) {
  const { locale } = useI18n()
  const zones = ref<Zone[]>([])
  const nameOf = (zone: Zone) => (locale.value === 'fr' ? zone.nameFr : zone.nameEn)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(text, (typed) => {
    clearTimeout(timer)
    if (typed.trim().length < 2) return
    timer = setTimeout(async () => {
      zones.value = (await api.suggestZones(typed).catch(() => ({ zones: [] }))).zones
    }, 200)
  })
  /** The zone typed: `{ zone }` of the dictionary, `{ zoneCustom }` otherwise, nothing when empty. */
  function read(): { zone?: string; zoneCustom?: string } {
    const typed = text.value.trim()
    if (!typed) return {}
    const match = [...zones.value, ...known.value].find((z) =>
      [z.nameEn, z.nameFr].some((n) => n.toLowerCase() === typed.toLowerCase()),
    )
    return match ? { zone: match.slug } : { zoneCustom: typed }
  }
  return { zones, nameOf, read }
}
