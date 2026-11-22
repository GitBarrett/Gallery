/** Browser connectivity (US-64.3), from the online and offline events; true during the server render. */
export function useOnline() {
  const online = useState('online', () => true)
  onMounted(() => {
    const update = () => (online.value = navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    onBeforeUnmount(() => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    })
  })
  return online
}

/**
 * True while a capture is being uploaded: the update toast waits for the end (US-65.2).
 * shortcut: never set until the upload form exists (T-26a sets it).
 */
export const useUploadInProgress = () => useState('upload-in-progress', () => false)
