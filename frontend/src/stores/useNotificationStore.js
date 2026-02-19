import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useNotificationStore — Persistent notification center.
 *
 * Collects events from WebSocket, MQTT, and recording state into a
 * browsable history. Components should call addNotification() to push
 * new notifications from wherever events originate.
 *
 * Notification shape:
 *  { id, type, title, message, timestamp, read, source }
 *
 * type: 'error' | 'warning' | 'info' | 'recording' | 'rule'
 */
export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],  // { id, type, title, message, timestamp, read, source }

      /** Add a new notification (auto-generates id and timestamp) */
      addNotification: ({ type = 'info', title, message, source = '' }) => {
        const newNotif = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          title,
          message,
          timestamp: new Date().toISOString(),
          read: false,
          source
        }
        set(state => ({
          notifications: [newNotif, ...state.notifications].slice(0, 100) // keep last 100
        }))
      },

      /** Mark a single notification as read */
      markRead: (id) => {
        set(state => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
        }))
      },

      /** Mark all as read */
      markAllRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true }))
        }))
      },

      /** Remove a single notification */
      dismiss: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }))
      },

      /** Clear all notifications */
      clearAll: () => set({ notifications: [] }),
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({ notifications: state.notifications })
    }
  )
)

// Selectors
export const selectUnreadCount = (state) => state.notifications.filter(n => !n.read).length
export const selectHasUnread = (state) => state.notifications.some(n => !n.read)
