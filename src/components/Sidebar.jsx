import React from 'react'
import { Home } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Sidebar({ page, setPage, data, setData }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Home }
  ]

  function toggleCollapse() {
    setData(prev => ({ ...prev, ui: { ...(prev.ui || {}), sidebarCollapsed: !prev.ui?.sidebarCollapsed } }))
  }

  const collapsed = !!data?.ui?.sidebarCollapsed

  return (
    <aside className={`sidebarFixed ${collapsed ? 'isCollapsed' : ''}`}>
      <div className="brand">
        <div className="logoMark" />
        {!collapsed && (
          <div className="brandText">
            <div className="brandTitle">FACT</div>
            <div className="brandSub muted">Facturation & pilotage</div>
          </div>
        )}
      </div>

      <nav className="navScroll">
        {items.map(it => {
          const Icon = it.icon
          const active = it.id === page
          return (
            <button
              key={it.id}
              onClick={() => setPage(it.id)}
              className={`navItem ${active ? 'active' : ''}`}
              title={it.label}
            >
              <span className="navIcon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="navLabel">{it.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebarBottomFixed">
        <ThemeToggle data={data} setData={setData} />
        <button onClick={toggleCollapse} className="btnSidebar" title={collapsed ? 'Ouvrir la barre' : 'Réduire la barre'}>
          <span className="btnSidebarIcon">{collapsed ? '▶' : '◀'}</span>
          <span className="btnSidebarText">{collapsed ? 'Ouvrir' : 'Réduire'}</span>
        </button>
        <div className="muted tiny sidebarMeta">Données locales • v0.1</div>
      </div>
    </aside>
  )
}
