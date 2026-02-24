import React, { createContext, useContext, useState, useEffect } from 'react'
import { PREMIUM_STORAGE_KEY, THEME_STORAGE_KEY } from './theme'

const ThemeContext = createContext(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const [premium, setPremium] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) || 'light'
      const premiumStored = localStorage.getItem(PREMIUM_STORAGE_KEY) || 'off'
      setTheme(stored)
      setPremium(premiumStored === 'ultra')
      document.documentElement.setAttribute('data-theme', stored)
      if (premiumStored === 'ultra') {
        document.documentElement.setAttribute('data-premium', 'ultra')
      } else {
        document.documentElement.removeAttribute('data-premium')
      }
    } catch (e) {
      console.error('Theme load error:', e)
    }
  }, [])

  const setMode = (newTheme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
    } catch (e) {
      console.error('Theme save error:', e)
    }
  }

  const setPremiumMode = (isUltra) => {
    setPremium(isUltra)
    try {
      localStorage.setItem(PREMIUM_STORAGE_KEY, isUltra ? 'ultra' : 'off')
      if (isUltra) {
        document.documentElement.setAttribute('data-premium', 'ultra')
      } else {
        document.documentElement.removeAttribute('data-premium')
      }
    } catch (e) {
      console.error('Premium save error:', e)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setMode, premium, setPremium: setPremiumMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
