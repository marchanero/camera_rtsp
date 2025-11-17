
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { SensorProvider } from './contexts/SensorContext'
import { Toaster } from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <SensorProvider apiUrl={API_URL}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              theme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              theme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <App />
      </SensorProvider>
    </ThemeProvider>
  </StrictMode>,
)
