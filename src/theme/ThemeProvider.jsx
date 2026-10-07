import React, { useEffect } from 'react'
import { PREMIUM_STORAGE_KEY, THEME_STORAGE_KEY } from './theme'

export default function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.removeAttribute('data-premium')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      localStorage.setItem(PREMIUM_STORAGE_KEY, 'off')
    } catch (e) {
      console.error('Theme reset error:', e)
    }
  }, [])

  return children
}
