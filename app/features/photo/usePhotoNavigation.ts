import { swipeDirection } from './swipe'

/**
 * Gestures of the photo page towards the previous and next captures (US-67.2): a touch swipe on `target`, and the
 * left and right arrow keys (04 § surprises: the arrows keep this role), except while typing in a field. The links
 * of PhotoNav do the same without them.
 */
export function usePhotoNavigation(
  target: Ref<HTMLElement | undefined>,
  neighbours: Ref<{ prev: string | null; next: string | null } | null>,
) {
  const localePath = useLocalePath()
  const go = (way: 'prev' | 'next') => {
    const id = neighbours.value?.[way]
    if (id) return navigateTo(localePath(`/p/${id}`))
  }

  let start: { x: number; y: number } | undefined
  const down = (e: PointerEvent) => {
    start = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : undefined
  }
  const up = (e: PointerEvent) => {
    if (!start) return
    const way = swipeDirection(e.clientX - start.x, e.clientY - start.y)
    start = undefined
    if (way) go(way)
  }
  const key = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
    if (typing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.key === 'ArrowLeft') go('prev')
    if (e.key === 'ArrowRight') go('next')
  }

  const cancel = () => (start = undefined) // the browser took the gesture (a vertical scroll)
  onMounted(() => {
    target.value?.addEventListener('pointerdown', down)
    target.value?.addEventListener('pointerup', up)
    target.value?.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
  })
  onBeforeUnmount(() => {
    target.value?.removeEventListener('pointerdown', down)
    target.value?.removeEventListener('pointerup', up)
    target.value?.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key)
  })
}
