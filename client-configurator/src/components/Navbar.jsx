import { useTheme } from '../contexts/ThemeContext'

const Navbar = ({ currentSection, setCurrentSection, setConfigTab }) => {
  const { theme, toggleTheme } = useTheme()

  const sections = ['Dashboard', 'Configuración']

  return (
    <nav className="bg-gray-50 dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Galgo-School
            </h1>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Research Platform</span>
          </div>
          <div className="flex items-center space-x-6">
            {sections.map(section => (
              <button
                key={section}
                onClick={() => {
                  setCurrentSection(section)
                  if (section === 'Configuración') {
                    setConfigTab('general')
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                  currentSection === section
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {section}
                {currentSection === section && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                )}
              </button>
            ))}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar