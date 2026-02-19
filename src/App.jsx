import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [data, setData] = useState({
    ui: { sidebarCollapsed: false },
    appConfig: { theme: 'light' }
  })

  useEffect(() => {
    const theme = data.appConfig?.theme || 'light'
    document.documentElement.setAttribute('data-theme', theme)
  }, [data.appConfig?.theme])

  const getPageTitle = () => {
    switch (page) {
      case 'settings':
        return 'Paramètres'
      default:
        return 'Tableau de bord'
    }
  }

  return (
    <div className={`appFrame ${data.ui?.sidebarCollapsed ? 'isCollapsed' : ''}`}>
      <Sidebar page={page} setPage={setPage} data={data} setData={setData} />
      <div className="mainWithSidebarOffset">
        <header className="topbar">
          <div>
            <div className="pageTitle">{getPageTitle()}</div>
            <div className="muted small">Facturation & Pilotage</div>
          </div>
        </header>
        <main className="contentScroll">
          {page === 'dashboard' && <Dashboard data={data} setData={setData} />}
          {page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}
