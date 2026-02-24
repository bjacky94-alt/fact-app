import React from 'react'
import { fmtEUR, invoiceHT, invoiceTTC, loadInvoices, invoiceTVA, loadSettingsLike } from '../lib/invoices'
import { loadExpenses } from '../lib/expenses'

const SETTINGS_KEY = 'fact_settings_v3'
const TAX_STORAGE_KEY = 'fact_tax_rs_v1'
const URSSAF_KEY = 'fact_urssaf_v1'
const DEFAULT_VAT_RATE = 20
const ACOMPTES_RATE = 0.8
const URSSAF_DEFAULT_RATE = 22

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function yearFromISO(iso) {
  const y = Number(String(iso || '').slice(0, 4))
  return Number.isFinite(y) ? y : 0
}

function vatFromTTC(ttc, rate = DEFAULT_VAT_RATE) {
  const amountTtc = Number(ttc) || 0
  const vatRate = Number(rate) || 0
  if (amountTtc <= 0 || vatRate <= 0) return 0
  return amountTtc - amountTtc / (1 + vatRate / 100)
}

function endOfMonthFromPeriod(ym) {
  const [year, month] = String(ym || '').split('-').map((v) => Number(v))
  if (!year || !month) return ''
  const dt = new Date(year, month, 0)
  const yyyy = String(dt.getFullYear())
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addMonthsISO(isoDate, monthsToAdd) {
  const raw = String(isoDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''

  const [y, m, d] = raw.split('-').map((x) => Number(x))
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setMonth(dt.getMonth() + (Number(monthsToAdd) || 0))

  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function StickyFinancialHeader({ compact = false, showAlert = false }) {
  const [refreshKey, setRefreshKey] = React.useState(0)
  
  // Écouter les changements des données pour forcer le rechargement
  React.useEffect(() => {
    const handleDataChange = () => {
      setRefreshKey((prev) => prev + 1)
    }
    
    window.addEventListener('invoicesUpdated', handleDataChange)
    window.addEventListener('expensesUpdated', handleDataChange)
    window.addEventListener('taxDataUpdated', handleDataChange)
    window.addEventListener('treasuryUpdated', handleDataChange)
    
    return () => {
      window.removeEventListener('invoicesUpdated', handleDataChange)
      window.removeEventListener('expensesUpdated', handleDataChange)
      window.removeEventListener('taxDataUpdated', handleDataChange)
      window.removeEventListener('treasuryUpdated', handleDataChange)
    }
  }, [])
  
  const now = new Date()
  const curYear = now.getFullYear()
  const settings = loadSettingsLike(SETTINGS_KEY)
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0
  const invoices = loadInvoices()
  const expenses = loadExpenses()

  // ===== TRÉSORERIE (même calcul que la page Trésorerie) =====
  // Charger les entrées manuelles de trésorerie
  const manualTreasuryEntries = (() => {
    try {
      const stored = localStorage.getItem('nodebox_treasury')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })()

  // Calculer le total (TOUTES années confondues + entrées manuelles)
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid')
  const totalIncome = round2(
    paidInvoices.reduce((sum, inv) => sum + invoiceTTC(inv, defaultTjm), 0) +
    manualTreasuryEntries.filter((e) => e.type === 'Revenu').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  )

  const totalExpenses = round2(
    expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) +
    manualTreasuryEntries.filter((e) => e.type === 'Dépense').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  )

  const balance = round2(totalIncome - totalExpenses)

  // ===== TVA =====
  const taxData = (() => {
    try {
      const raw = localStorage.getItem(TAX_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      return {
        selectedYear: Number(parsed?.selectedYear) || curYear,
        byYear: parsed?.byYear && typeof parsed.byYear === 'object' ? parsed.byYear : {},
      }
    } catch {
      return {
        selectedYear: curYear,
        byYear: {},
      }
    }
  })()

  const yearTaxData = taxData.byYear?.[curYear] || {}

  // Calculer TVA collectée et déductible
  const vatCollected = (() => {
    let total = 0
    let janToJul = 0
    let augToDec = 0

    for (const inv of invoices) {
      if (inv.status !== 'paid') continue
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (yearFromISO(paidDate) !== curYear) continue

      const month = Number(paidDate.slice(5, 7))
      const vat = invoiceTVA(inv, defaultTjm)

      total += vat
      if (month >= 1 && month <= 7) janToJul += vat
      if (month >= 8 && month <= 12) augToDec += vat
    }

    return {
      total: round2(total),
      janToJul: round2(janToJul),
      augToDec: round2(augToDec),
    }
  })()

  const vatDeductible = round2(
    expenses
      .filter((exp) => yearFromISO(exp.date) === curYear)
      .reduce((sum, exp) => sum + vatFromTTC(exp.amount), 0)
  )

  const acompte1Auto = round2(vatCollected.janToJul * ACOMPTES_RATE)
  const acompte2Auto = round2(vatCollected.augToDec * ACOMPTES_RATE)

  const acompte1 = yearTaxData.manualAcompte1 !== undefined && yearTaxData.manualAcompte1 !== null 
    ? Number(yearTaxData.manualAcompte1) 
    : acompte1Auto
  const acompte2 = yearTaxData.manualAcompte2 !== undefined && yearTaxData.manualAcompte2 !== null
    ? Number(yearTaxData.manualAcompte2)
    : acompte2Auto
  const totalAcomptes = round2(acompte1 + acompte2)

  // Calculer le total des acomptes PAYÉS uniquement
  const acompte1Paid = /^\d{4}-\d{2}-\d{2}$/.test(yearTaxData.paidDateAcompte1 || '') ? acompte1 : 0
  const acompte2Paid = /^\d{4}-\d{2}-\d{2}$/.test(yearTaxData.paidDateAcompte2 || '') ? acompte2 : 0
  const totalAcomptesPaid = round2(acompte1Paid + acompte2Paid)

  const vatNetDue = Math.max(vatCollected.total - vatDeductible, 0)
  
  // Calcul du montant TOTAL de TVA à provisionner
  const totalVatToProvision = (() => {
    // 1. TVA restante de l'année en cours (après acomptes PAYÉS)
    const currentYearVat = Math.max(vatNetDue - totalAcomptesPaid, 0)
    
    // 2. CA12 déclarés mais pas encore payés (toutes années)
    let unpaidCA12 = 0
    const byYear = taxData.byYear || {}
    
    for (const [, data] of Object.entries(byYear)) {
      const paidDate = String(data?.paidDate || '').trim()
      const amount = Number(data?.declaredCa12Amount) || 0
      
      // Si déclaré mais pas encore payé
      if (amount > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
        unpaidCA12 += amount
      }
    }
    
    return round2(currentYearVat + unpaidCA12)
  })()
  
  const tvaRemaining = totalVatToProvision
  // ===== URSSAF =====
  const urssafData = (() => {
    try {
      const raw = localStorage.getItem(URSSAF_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      return {
        globalRate: Number(parsed?.globalRate) > 0 ? Number(parsed.globalRate) : URSSAF_DEFAULT_RATE,
        byPeriod: parsed?.byPeriod && typeof parsed.byPeriod === 'object' ? parsed.byPeriod : {},
      }
    } catch {
      return {
        globalRate: URSSAF_DEFAULT_RATE,
        byPeriod: {},
      }
    }
  })()

  const urssafRemaining = (() => {
    let total = 0

    for (const inv of invoices) {
      if (inv.status !== 'paid') continue
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) continue

      const ym = paidDate.slice(0, 7)
      const y = Number(ym.slice(0, 4))
      if (y !== curYear) continue

      const amountHT = invoiceHT(inv, defaultTjm)
      const stored = urssafData.byPeriod?.[ym] || {}
      const rate = Number(stored.rate)
      const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : Number(urssafData.globalRate) || URSSAF_DEFAULT_RATE
      const paidDate2 = String(stored.paidDate || '')
      const amountDue = Math.round(((Number(amountHT) || 0) * effectiveRate) / 100)

      if (!paidDate2) {
        total += amountDue
      }
    }

    return round2(total)
  })()

  // Calculer le total à provisionner (TVA + URSSAF)
  const totalToProvision = round2(tvaRemaining + urssafRemaining)
  const isBalanceLow = balance < totalToProvision && balance >= 0

  const textBalanceClass = isBalanceLow ? 'statusDue' : (balance >= 0 ? 'statusGood' : 'statusDue')
  const textTvaClass = tvaRemaining > 0 ? 'statusWarn' : 'statusGood'
  const textUrssafClass = urssafRemaining > 0 ? 'statusWarn' : 'statusGood'

  if (compact) {
    // Si showAlert est true, afficher seulement l'alerte au centre
    if (showAlert) {
      if (!isBalanceLow) return null
      
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(220, 38, 38, 0.3)',
        }}>
          <div style={{ 
            fontSize: 12, 
            color: 'var(--statusDue)', 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 6,
              height: 6,
              backgroundColor: 'var(--statusDue)',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
            ⚠️ Trésorerie insuffisante : {fmtEUR(balance)} {'<'} TVA+URSSAF ({fmtEUR(totalToProvision)})
          </div>
        </div>
      )
    }
    
    // Sinon, afficher les indicateurs sans l'alerte
    return (
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          <div className="muted tiny" style={{ fontSize: 9, letterSpacing: 0.5 }}>💰 TRÉSO</div>
          <div className={`statusText ${textBalanceClass}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtEUR(balance)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          <div className="muted tiny" style={{ fontSize: 9, letterSpacing: 0.5 }}>🔵 TVA</div>
          <div className={`statusText ${textTvaClass}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtEUR(tvaRemaining)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          <div className="muted tiny" style={{ fontSize: 9, letterSpacing: 0.5 }}>🏛️ URSSAF</div>
          <div className={`statusText ${textUrssafClass}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtEUR(urssafRemaining)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 20px',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 20,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="muted small" style={{ fontSize: 11, letterSpacing: 0.5 }}>💰 SOLDE TRÉSORERIE</div>
        <div className={`statusText ${textBalanceClass}`} style={{ fontSize: 16, fontWeight: 800 }}>
          {fmtEUR(balance)}
        </div>
        <div className="muted small" style={{ fontSize: 10 }}>
          {fmtEUR(totalIncome)} - {fmtEUR(totalExpenses)}
        </div>
        {isBalanceLow && (
          <div style={{ 
            fontSize: 9, 
            color: 'var(--statusDue)', 
            fontWeight: 700, 
            marginTop: 2,
            animation: 'pulse 2s infinite'
          }}>
            ⚠️ Insuffisant pour TVA+URSSAF ({fmtEUR(totalToProvision)})
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="muted small" style={{ fontSize: 11, letterSpacing: 0.5 }}>🔵 TVA À PROVISIONNER</div>
        <div className={`statusText ${textTvaClass}`} style={{ fontSize: 16, fontWeight: 800 }}>
          {fmtEUR(tvaRemaining)}
        </div>
        <div className="muted small" style={{ fontSize: 10 }}>Année {curYear} + CA12 à payer</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="muted small" style={{ fontSize: 11, letterSpacing: 0.5 }}>🏛️ URSSAF RESTANTE</div>
        <div className={`statusText ${textUrssafClass}`} style={{ fontSize: 16, fontWeight: 800 }}>
          {fmtEUR(urssafRemaining)}
        </div>
        <div className="muted small" style={{ fontSize: 10 }}>À déclarer et payer</div>
      </div>
    </div>
  )
}
