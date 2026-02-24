import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import ThemeProvider from './theme/ThemeProvider'
import AppRouter from './app/router'

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
    </Router>
  )
}
