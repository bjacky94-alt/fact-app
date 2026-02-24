import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../layout/Layout'
import DashboardPage from '../pages/DashboardPage'
import InvoicesPage from '../pages/InvoicesPage'
import InvoiceDetailPage from '../pages/InvoiceDetailPage'
import ExpensesPage from '../pages/ExpensesPage'
import LeavesPage from '../pages/LeavesPage'
import SettingsPage from '../pages/SettingsPage'
import TaxPage from '../pages/TaxPage'
import TreasuryPage from '../pages/TreasuryPage'
import UrssafPage from '../pages/UrssafPage'
import LoginPage from '../pages/LoginPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/leaves" element={<LeavesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/tax" element={<TaxPage />} />
        <Route path="/treasury" element={<TreasuryPage />} />
        <Route path="/urssaf" element={<UrssafPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
