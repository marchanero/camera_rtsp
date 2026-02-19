import { useState, useRef, useEffect } from 'react'
import { useNotificationStore, selectUnreadCount } from '../stores/useNotificationStore'
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react'

const TYPE_CONFIG = {
    error: { icon: '🔴', label: 'Error', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
    warning: { icon: '🟡', label: 'Aviso', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-500' },
    recording: { icon: '📹', label: 'Grabación', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
    rule: { icon: '⚡', label: 'Regla', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
    info: { icon: '🔵', label: 'Info', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', dot: 'bg-gray-400' },
}

function timeAgo(isoString) {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diff < 60) return `hace ${diff}s`
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
    return new Date(isoString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default function NotificationPanel() {
    const [open, setOpen] = useState(false)
    const panelRef = useRef(null)

    const notifications = useNotificationStore(s => s.notifications)
    const unreadCount = useNotificationStore(selectUnreadCount)
    const markRead = useNotificationStore(s => s.markRead)
    const markAllRead = useNotificationStore(s => s.markAllRead)
    const dismiss = useNotificationStore(s => s.dismiss)
    const clearAll = useNotificationStore(s => s.clearAll)

    // Close panel on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead() }}
                className="relative p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                title="Notificaciones"
                aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} nuevas)` : ''}`}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4 text-blue-500" />
                            Notificaciones
                            {notifications.length > 0 && (
                                <span className="text-xs text-gray-400 font-normal">({notifications.length})</span>
                            )}
                        </h3>
                        <div className="flex items-center gap-1">
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={markAllRead}
                                        title="Marcar todas como leídas"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        title="Borrar todas"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Bell className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">Sin notificaciones</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                {notifications.map(n => {
                                    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
                                    return (
                                        <li
                                            key={n.id}
                                            className={`px-4 py-3 flex gap-3 items-start transition-colors ${n.read ? '' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}
                                            onClick={() => markRead(n.id)}
                                        >
                                            <span className="text-lg flex-shrink-0 mt-0.5">{cfg.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                                                        {n.title}
                                                    </p>
                                                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.timestamp)}</span>
                                                </div>
                                                {n.message && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                                                )}
                                                {n.source && (
                                                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">{n.source}</span>
                                                )}
                                            </div>
                                            {!n.read && <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                                                className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                                title="Descartar"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
