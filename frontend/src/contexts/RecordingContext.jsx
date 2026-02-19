import { useEffect } from 'react'
import { useRecordingStore } from '../stores/useRecordingStore'

// Re-export the backward compat hook from the store
export { useRecording } from '../stores/useRecordingStore'

/**
 * RecordingProvider — Thin wrapper that initializes the Zustand store.
 * 
 * All state now lives in useRecordingStore (Zustand).
 * This component only handles:
 *   1. Initial sync with backend on mount
 *   2. Re-sync on visibility change (tab switch / browser restore)
 * 
 * Children can import { useRecording } or useRecordingStore directly.
 */
export function RecordingProvider({ children }) {
  const syncFromBackend = useRecordingStore(s => s.syncFromBackend)

  // ─── Initial sync with backend ─────────────────────────────────────────
  useEffect(() => {
    let pollingInterval = null
    let attempts = 0
    const POLLING_INTERVAL = 5000
    const FAST_POLLING_DURATION = 10000

    const performSync = async () => {
      if (attempts === 0) console.log('🔄 Sincronizando estado de grabaciones...')
      await syncFromBackend()
      attempts++

      // Stop polling after first successful sync
      if (attempts >= 1 && pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
        console.log('⏹️ Polling inicial detenido tras primer sync exitoso')
      }
    }

    performSync()
    pollingInterval = setInterval(performSync, POLLING_INTERVAL)

    const timeoutId = setTimeout(() => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        console.log('⏹️ Polling rápido inicial finalizado')
      }
    }, FAST_POLLING_DURATION)

    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
      clearTimeout(timeoutId)
    }
  }, [syncFromBackend])

  // ─── Re-sync on page visibility change ─────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Página visible, re-sincronizando grabaciones...')
        syncFromBackend()
      }
    }

    const handlePageShow = (event) => {
      if (event.persisted) {
        console.log('📄 Página restaurada desde caché, re-sincronizando...')
        syncFromBackend()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [syncFromBackend])

  return children
}
