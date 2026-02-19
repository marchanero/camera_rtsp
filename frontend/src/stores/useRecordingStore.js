import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useRecordingStore — Zustand store for recording state management
 * 
 * Replaces RecordingContext.jsx with selective subscriptions to avoid
 * re-rendering all consumers when any recording state changes.
 * 
 * State is persisted to localStorage via zustand/persist middleware,
 * preserving recording state across page reloads.
 */
export const useRecordingStore = create(
  persist(
    (set, get) => ({
      // ─── State ───────────────────────────────────────────────────────────
      // recordings: Map<cameraId, RecordingInfo>
      // Stored as array for JSON serialization (Maps aren't JSON-serializable)
      recordingsArray: [], // [[cameraId, RecordingInfo], ...]
      globalRecordingStatus: 'idle', // 'idle' | 'starting' | 'recording' | 'stopping'
      initialSyncDone: false,
      isSyncing: true,

      // ─── Derived helpers (not stored, computed on demand) ────────────────
      _getMap: () => new Map(get().recordingsArray),

      _setMap: (mapOrUpdater) => {
        if (typeof mapOrUpdater === 'function') {
          const currentMap = new Map(get().recordingsArray)
          const nextMap = mapOrUpdater(currentMap)
          set({ recordingsArray: Array.from(nextMap.entries()) })
        } else {
          set({ recordingsArray: Array.from(mapOrUpdater.entries()) })
        }
      },

      // ─── Sync actions ────────────────────────────────────────────────────

      /**
       * Sync recording state from backend on mount / visibility change.
       * Fetches /api/recordings/sync/status and reconciles local state.
       */
      syncFromBackend: async () => {
        const { _setMap, initialSyncDone } = get()
        try {
          if (!initialSyncDone) set({ isSyncing: true })

          const response = await fetch('/api/recordings/sync/status')
          if (!response.ok) throw new Error('Network response was not ok')

          const backendStatus = await response.json()

          const recordingDetailsMap = new Map()
          if (backendStatus.sessions) {
            for (const session of backendStatus.sessions) {
              recordingDetailsMap.set(session.cameraId, session)
            }
          }

          const activeBackendRecordings = new Set(
            (backendStatus.sessions || []).map(s => s.cameraId)
          )

          _setMap(prev => {
            const updated = new Map()

            for (const [cameraId, recordingInfo] of prev.entries()) {
              if (activeBackendRecordings.has(cameraId)) {
                const detail = recordingDetailsMap.get(cameraId)
                updated.set(cameraId, {
                  ...recordingInfo,
                  status: 'recording',
                  startedAt: detail?.startTime ? new Date(detail.startTime).toISOString() : recordingInfo.startedAt,
                  elapsedSeconds: detail?.elapsedSeconds || 0,
                  scenarioName: detail?.scenarioName || recordingInfo.scenarioName
                })
              }
            }

            for (const cameraId of activeBackendRecordings) {
              if (!updated.has(cameraId)) {
                const detail = recordingDetailsMap.get(cameraId)
                updated.set(cameraId, {
                  status: 'recording',
                  cameraName: detail?.cameraName || `Cámara ${cameraId}`,
                  startedAt: detail?.startTime ? new Date(detail.startTime).toISOString() : new Date().toISOString(),
                  elapsedSeconds: detail?.elapsedSeconds || 0,
                  scenarioName: detail?.scenarioName
                })
              }
            }

            if (activeBackendRecordings.size === 0 && prev.size > 0) {
              return new Map()
            }

            return updated.size !== prev.size ? updated : (updated.size === 0 ? updated : prev.size === updated.size ? updated : updated)
          })

          if (!initialSyncDone) {
            set({ initialSyncDone: true })
          }

        } catch (error) {
          console.error('❌ Error sincronizando estado de grabación:', error)
        } finally {
          set({ isSyncing: false })
        }
      },

      /**
       * Sync individual camera recording status from backend.
       */
      syncRecordingStatus: async (cameraId, cameraName) => {
        const { _setMap } = get()
        try {
          const response = await fetch(`/api/recordings/sync/${cameraId}/status`)

          if (response.status === 404) return false

          const data = await response.json()

          if (data.success && data.session && data.session.status === 'recording') {
            _setMap(prev => {
              const existing = prev.get(cameraId)
              if (!existing) {
                return new Map(prev).set(cameraId, {
                  status: 'recording',
                  cameraName,
                  startedAt: new Date(data.session.masterTimestamp).toISOString(),
                  elapsedSeconds: data.session.duration || 0,
                  scenarioName: data.session.scenarioName
                })
              }
              return prev
            })
            return true
          }
          return false
        } catch (error) {
          console.error('Error sincronizando estado:', error)
          return false
        }
      },

      // ─── Recording actions ────────────────────────────────────────────────

      /**
       * Start recording for a specific camera.
       * @param {number} cameraId
       * @param {string} cameraName
       * @param {{ scenarioId?: number, scenarioName?: string }} options
       */
      startRecording: async (cameraId, cameraName, options = {}) => {
        const { _setMap } = get()
        try {
          _setMap(prev => new Map(prev).set(cameraId, {
            status: 'starting',
            cameraName,
            startedAt: null
          }))

          const requestBody = {
            camera: { id: cameraId, name: cameraName, rtspUrl: 'auto' },
            scenarioId: options.scenarioId,
            scenarioName: options.scenarioName,
            sensorTopics: []
          }

          const response = await fetch('/api/recordings/sync/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })

          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Error iniciando grabación')
          }

          _setMap(prev => new Map(prev).set(cameraId, {
            status: 'recording',
            cameraName,
            scenarioId: options.scenarioId,
            scenarioName: options.scenarioName,
            startedAt: new Date().toISOString()
          }))

          return { success: true, data }

        } catch (error) {
          console.error('❌ Error iniciando grabación:', error)
          _setMap(prev => new Map(prev).set(cameraId, {
            status: 'error',
            cameraName,
            error: error.message
          }))
          return { success: false, error: error.message }
        }
      },

      /**
       * Stop recording for a specific camera.
       */
      stopRecording: async (cameraId) => {
        const { _getMap, _setMap } = get()
        try {
          const current = _getMap().get(cameraId)
          _setMap(prev => new Map(prev).set(cameraId, {
            ...current,
            status: 'stopping'
          }))

          const response = await fetch(`/api/recordings/sync/${cameraId}/stop`, {
            method: 'POST'
          })

          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Error deteniendo grabación')
          }

          _setMap(prev => {
            const next = new Map(prev)
            next.delete(cameraId)
            return next
          })

          return { success: true, data }

        } catch (error) {
          console.error('❌ Error deteniendo grabación:', error)
          _setMap(prev => {
            const current = prev.get(cameraId)
            if (current) {
              return new Map(prev).set(cameraId, {
                ...current,
                status: 'recording'
              })
            }
            return prev
          })
          return { success: false, error: error.message }
        }
      },

      /**
       * Start recording for all cameras.
       */
      startAllRecordings: async (cameras, options = {}) => {
        const { startRecording } = get()
        set({ globalRecordingStatus: 'starting' })
        const results = await Promise.allSettled(
          cameras.map(camera => startRecording(camera.id, camera.name, options))
        )
        set({ globalRecordingStatus: 'recording' })
        return results
      },

      /**
       * Stop all active recordings.
       */
      stopAllRecordings: async () => {
        const { _getMap, stopRecording } = get()
        set({ globalRecordingStatus: 'stopping' })
        const cameraIds = Array.from(_getMap().keys())
        const results = await Promise.allSettled(
          cameraIds.map(id => stopRecording(id))
        )
        set({ globalRecordingStatus: 'idle' })
        return results
      },

      // ─── File actions ─────────────────────────────────────────────────────

      getRecordings: async (cameraId) => {
        try {
          const response = await fetch(`/api/media/recordings/${cameraId}`)
          const data = await response.json()
          return data.recordings || []
        } catch (error) {
          console.error('Error obteniendo grabaciones:', error)
          return []
        }
      },

      downloadRecording: (cameraId, filename) => {
        window.open(`/api/media/download/${cameraId}/${filename}`, '_blank')
      },

      deleteRecording: async (cameraId, filename) => {
        try {
          const response = await fetch(`/api/media/recording/${cameraId}/${filename}`, {
            method: 'DELETE'
          })
          const data = await response.json()
          return { success: data.success, message: data.message }
        } catch (error) {
          console.error('Error eliminando grabación:', error)
          return { success: false, error: error.message }
        }
      },
    }),
    {
      name: 'recording-store',
      // Only persist the recordings array (not transient UI state)
      partialize: (state) => ({ recordingsArray: state.recordingsArray }),
      // Restore dates as ISO strings (they were already strings in the store)
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Re-hydrate is complete; mark initial sync as not done so it re-syncs with backend
          state.initialSyncDone = false
          state.isSyncing = true
        }
      }
    }
  )
)

// ─── Derived selectors ────────────────────────────────────────────────────────
// Use these for targeted subscriptions — components only re-render
// when the specific slice they subscribe to changes.

/** Returns a Map<cameraId, RecordingInfo> */
export const selectRecordingsMap = (state) => new Map(state.recordingsArray)

/** Returns true if any camera is recording */
export const selectIsAnyRecording = (state) => state.recordingsArray.length > 0

/** Returns the count of active recordings */
export const selectActiveRecordingsCount = (state) => state.recordingsArray.length

/** Returns recording info for a specific camera */
export const selectCameraRecording = (cameraId) => (state) =>
  state.recordingsArray.find(([id]) => id === cameraId)?.[1] || { status: 'idle' }

/** Returns true if a specific camera is recording or starting */
export const selectIsCameraRecording = (cameraId) => (state) => {
  const entry = state.recordingsArray.find(([id]) => id === cameraId)
  const status = entry?.[1]?.status
  return status === 'recording' || status === 'starting'
}

/** Returns the maximum elapsed seconds across all recording cameras */
export const selectMaxElapsedSeconds = (state) => {
  let max = 0
  for (const [, info] of state.recordingsArray) {
    if (info.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(info.startedAt).getTime()) / 1000)
      if (elapsed > max) max = elapsed
    }
    if (info.elapsedSeconds && info.elapsedSeconds > max) max = info.elapsedSeconds
  }
  return max
}

/** Returns the oldest recording start time (as Date | null) */
export const selectOldestStartTime = (state) => {
  let oldest = null
  for (const [, info] of state.recordingsArray) {
    if (info.startedAt) {
      const startTime = new Date(info.startedAt)
      if (!oldest || startTime < oldest) oldest = startTime
    }
  }
  return oldest
}

/**
 * Backward-compatibility hook — drop-in replacement for useRecording().
 * Components that only need a few fields should use useRecordingStore()
 * with specific selectors for better performance.
 */
export function useRecording() {
  const store = useRecordingStore()
  const recordingsMap = selectRecordingsMap(store)

  return {
    // State
    recordings: recordingsMap,
    globalRecordingStatus: store.globalRecordingStatus,
    initialSyncDone: store.initialSyncDone,
    isSyncing: store.isSyncing,

    // Actions
    startRecording: store.startRecording,
    stopRecording: store.stopRecording,
    syncRecordingStatus: store.syncRecordingStatus,
    startAllRecordings: store.startAllRecordings,
    stopAllRecordings: store.stopAllRecordings,

    // Queries
    getRecordingStatus: (cameraId) => recordingsMap.get(cameraId) || { status: 'idle' },
    isRecording: (cameraId) => {
      const status = recordingsMap.get(cameraId)?.status
      return status === 'recording' || status === 'starting'
    },
    getRecordings: store.getRecordings,

    // File ops
    downloadRecording: store.downloadRecording,
    deleteRecording: store.deleteRecording,

    // Stats
    activeRecordingsCount: store.recordingsArray.length,
    isAnyRecording: store.recordingsArray.length > 0,
    getMaxElapsedSeconds: () => selectMaxElapsedSeconds(store),
    getOldestStartTime: () => selectOldestStartTime(store),
  }
}
