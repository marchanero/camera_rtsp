import './App.css'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './contexts/ThemeContext'
import { RecordingProvider } from './contexts/RecordingContext'
import { MQTTProvider } from './contexts/MQTTContext'
import { ScenarioProvider } from './contexts/ScenarioContext'
import AppContent from './components/app/AppContent'
import AppErrorBoundary from './components/AppErrorBoundary'

/**
 * App - Root component with providers
 * 
 * Refactored from 574 to ~40 lines by:
 * - Extracting AppHeader to separate component
 * - Extracting ConfigurationContent to separate component
 * - Extracting AppContent to separate component
 * - Creating useAppState hook for state management
 */
function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <ScenarioProvider>
          <MQTTProvider>
            <RecordingProvider>
              <AppContent />
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#1f2937',
                    color: '#f9fafb',
                    borderRadius: '12px',
                    padding: '12px 16px',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#f9fafb',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#f9fafb',
                    },
                  },
                }}
              />
            </RecordingProvider>
          </MQTTProvider>
        </ScenarioProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  )
}

export default App