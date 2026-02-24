import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import ThemeSwitch from '../components/ThemeSwitch'
import PremiumSwitch from '../components/PremiumSwitch'
import StickyFinancialHeader from '../components/StickyFinancialHeader'
import CloudSyncStatus from '../components/CloudSyncStatus'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Calendar,
  Settings,
  Landmark,
  BadgePercent,
  Wallet,
  Menu,
  X,
  LogIn,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Factures', icon: Receipt },
  { to: '/expenses', label: 'Dépenses', icon: CreditCard },
  { to: '/leaves', label: 'Congés', icon: Calendar },
  { to: '/treasury', label: 'Trésorerie', icon: Wallet },
  { to: '/tax', label: 'Impôts', icon: BadgePercent },
  { to: '/urssaf', label: 'URSSAF', icon: Landmark },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const currentTitle =
    navItems.find((item) => location.pathname.startsWith(item.to))?.label ||
    'Facturation'

  const handleAuthClick = () => {
    if (user) {
      signOut()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className={`appFrame ${isCollapsed ? 'isCollapsed' : ''}`}>
      <aside className="sidebarFixed">
        <div className="brand">
          <div className="logoMark" />
          <div className="brandText">
            <div className="brandTitle">NODEBOX</div>
            <div className="brandSub muted small">Facturation & Pilotage</div>
          </div>
        </div>

        <nav className="navScroll">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `navItem ${isActive ? 'active' : ''}`
                }
              >
                <span className="navDot" />
                <span className="navIcon">
                  <Icon size={18} />
                </span>
                <span className="navLabel">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebarBottomFixed">
          <div style={{ paddingLeft: 12, paddingRight: 12, marginBottom: 8 }}>
            <CloudSyncStatus />
          </div>
          <button
            type="button"
            className="btnSidebar"
            onClick={handleAuthClick}
            style={{ marginBottom: 8 }}
          >
            <span className="btnSidebarIcon">
              {user ? <LogOut size={18} /> : <LogIn size={18} />}
            </span>
            <span className="btnSidebarText">
              {user ? 'Déconnexion' : 'Connexion'}
            </span>
          </button>
          <ThemeSwitch />
          <PremiumSwitch />
          <button
            type="button"
            className="btnSidebar"
            onClick={() => setIsCollapsed((prev) => !prev)}
          >
            <span className="btnSidebarIcon">
              {isCollapsed ? <Menu size={18} /> : <X size={18} />}
            </span>
            <span className="btnSidebarText">Réduire</span>
          </button>
          <div className="sidebarMeta muted tiny">
            v1.0 • 2026
          </div>
        </div>
      </aside>

      <main className="mainWithSidebarOffset">
        <header className="topbar" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingRight: 20 }}>
          <div className="pageTitle">{currentTitle}</div>
          <StickyFinancialHeader compact={true} showAlert={true} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end' }}>
            <StickyFinancialHeader compact={true} showAlert={false} />
            <span className="pill">Synthèse</span>
          </div>
        </header>
        <div className="contentScroll">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
