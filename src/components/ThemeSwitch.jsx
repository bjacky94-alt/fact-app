import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'

export default function ThemeSwitch() {
  const { theme, setMode } = useTheme()

  const toggle = () => {
    setMode(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      className="btnTheme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className="btnThemeIcon">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </span>
      <span className="btnThemeText">{theme === 'light' ? 'Sombre' : 'Clair'}</span>
    </button>
  )
}
