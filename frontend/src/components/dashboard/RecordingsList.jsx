import React, { useState } from 'react'
import { FileVideo, Film, Download, Trash2 } from 'lucide-react'
import { formatFileSize, formatTime } from '../../utils/formatters'

/**
 * RecordingsList - Display and manage recordings for selected camera
 * 
 * Features:
 * - Tabbed interface (video/sensors)
 * - Recording list with metadata
 * - Download and delete actions
 * - Formatted file sizes and durations
 */
const RecordingsList = ({
    selectedCamera,
    videoRecordings = [],
    sensorRecordings = [],
    onClose,
    onDownload,
    onDelete
}) => {
    const [activeTab, setActiveTab] = useState('video')

    if (!selectedCamera) return null

    const handleDelete = async (filename) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar la grabación "${filename}"?`)) return
        await onDelete(filename)
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-orange-500" />
                    Grabaciones - {selectedCamera.name}
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    ×
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('video')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'video'
                        ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Film className="w-4 h-4" />
                        <span>Video ({videoRecordings.length})</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('sensors')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'sensors'
                        ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <FileVideo className="w-4 h-4" />
                        <span>Sensores ({sensorRecordings.length})</span>
                    </div>
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
                {activeTab === 'video' ? (
                    videoRecordings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Film className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No hay grabaciones de video</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {videoRecordings.map((recording, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${recording.isLocked
                                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                            : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {recording.filename}
                                            </p>
                                            {recording.isLocked && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                    🔴 Grabando
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {recording.duration && (
                                                <span>⏱️ {formatTime(recording.duration)}</span>
                                            )}
                                            {recording.size && (
                                                <span>💾 {formatFileSize(recording.size)}</span>
                                            )}
                                            {recording.date && (
                                                <span>📅 {new Date(recording.date).toLocaleDateString()}</span>
                                            )}
                                            {recording.isLocked && (
                                                <span className="text-red-500">⚠️ No disponible</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => onDownload(recording.filename)}
                                            disabled={recording.isLocked}
                                            className={`p-2 rounded transition-colors ${recording.isLocked
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                }`}
                                            title={recording.isLocked ? 'Grabación en curso' : 'Descargar'}
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(recording.filename)}
                                            disabled={recording.isLocked}
                                            className={`p-2 rounded transition-colors ${recording.isLocked
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                }`}
                                            title={recording.isLocked ? 'Grabación en curso - no se puede eliminar' : 'Eliminar'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    sensorRecordings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <FileVideo className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No hay grabaciones de sensores</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sensorRecordings.map((recording, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {recording.filename}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {recording.records && (
                                                <span>📊 {recording.records} registros</span>
                                            )}
                                            {recording.size && (
                                                <span>💾 {formatFileSize(recording.size)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => onDownload(recording.filename)}
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                            title="Descargar"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

export default RecordingsList
