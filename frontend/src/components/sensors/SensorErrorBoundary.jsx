import React from 'react'

/**
 * SensorErrorBoundary — Wraps individual sensor cards.
 * If a sensor card throws (e.g. malformed MQTT payload), only that card
 * shows an error message instead of crashing the whole dashboard.
 */
class SensorErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        console.error('Sensor render error:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center min-h-[110px]">
                    <span className="text-xs text-red-500 text-center">Error renderizado</span>
                </div>
            )
        }
        return this.props.children
    }
}

export default SensorErrorBoundary
