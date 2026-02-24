import React from 'react'
import { Sparkles } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'

export default function PremiumSwitch() {
  const { premium, setPremium } = useTheme()

  const toggle = () => {
    setPremium(!premium)
  }

  return (
    <button
      onClick={toggle}
      className="btnTheme"
      title={premium ? 'Desactiver ultra premium' : 'Activer ultra premium'}
      type="button"
    >
      <span className="btnThemeIcon">
        <Sparkles size={18} />
      </span>
      <span className="btnThemeText">{premium ? 'Ultra ON' : 'Ultra OFF'}</span>
    </button>
  )
}
