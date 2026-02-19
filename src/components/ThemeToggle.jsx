import React from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ data, setData }) {
  const theme = data?.appConfig?.theme || 'light'

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setData(prev => ({ ...prev, appConfig: { ...prev.appConfig, theme: next } }))
  }

  return (
    <button onClick={toggle} className="btnTheme">
      <span className="btnThemeIcon">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      <span className="btnThemeText">{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
    </button>
  )
}
