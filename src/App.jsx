import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'

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

  return (
    <div className={`appFrame ${data.ui?.sidebarCollapsed ? 'isCollapsed' : ''}`}>
      <Sidebar page={page} setPage={setPage} data={data} setData={setData} />
      <div className="mainWithSidebarOffset">
        <header className="topbar">
          <div>
            <div className="pageTitle">FACT</div>
            <div className="muted small">Facturation & Pilotage</div>
          </div>
        </header>
        <main className="contentScroll">
          {page === 'dashboard' && <Dashboard data={data} setData={setData} />}
        </main>
      </div>
    </div>
  )
}
