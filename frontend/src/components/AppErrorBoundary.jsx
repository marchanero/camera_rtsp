import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * AppErrorBoundary — Global crash shield for the entire application.
 *
 * Catches unhandled React render errors and shows a recovery UI
 * instead of the blank white screen.
 *
 * Usage: wrap <App> in index.jsx
 */
export default class AppErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo })
        console.error('🔴 AppErrorBoundary caught:', error, errorInfo)
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.reload()
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-gray-900 border border-red-800/50 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/30 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>

                    <h1 className="text-xl font-bold text-white mb-2">Algo salió mal</h1>
                    <p className="text-gray-400 text-sm mb-6">
                        La aplicación encontró un error inesperado. Puedes intentar recargar la página.
                    </p>

                    {this.state.error && (
                        <details className="mb-6 text-left bg-gray-800 rounded-lg p-3">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                                Detalles del error
                            </summary>
                            <pre className="mt-2 text-xs text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}

                    <button
                        onClick={this.handleReload}
                        className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recargar aplicación
                    </button>
                </div>
            </div>
        )
    }
}
