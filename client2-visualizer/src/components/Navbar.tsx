import { useTheme } from '../hooks/useTheme';
import { useUser } from '../contexts/UserContext';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme()
  const { user } = useUser()

  return (
    <nav className="bg-gray-50 dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Galgo-School
            </h1>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Monitor de Sistema</span>
          </div>
          
          {/* Sección de información del usuario */}
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 dark:text-gray-400">Usuario:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user ? user.name : '--'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 dark:text-gray-400">Asignatura:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user ? user.subject : '--'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                console.log('🖱️ Botón de tema clickeado en Navbar');
                toggleTheme();
              }}
              className="relative p-2 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group"
              title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
              aria-label={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
            >
              <div className="relative w-6 h-6">
                {/* Sol (modo claro) */}
                <svg
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    theme === 'light'
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 rotate-90 scale-75'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>

                {/* Luna (modo oscuro) */}
                <svg
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    theme === 'dark'
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 -rotate-90 scale-75'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar