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

function isISO(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').trim())
}

function toISO(year, month, day) {
  const yyyy = String(year)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function monthKeyFromISO(iso) {
  return isISO(iso) ? String(iso).slice(0, 7) : ''
}

function monthLabel(ym) {
  const [year, month] = String(ym || '').split('-').map((v) => Number(v))
  if (!year || !month) return '—'
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
  })
}

function isWeekday(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function isHolidayDate(isoDate) {
  try {
    const cache = JSON.parse(localStorage.getItem('_holidays_cache') || '{}')
    const holidaysStr = cache[isoDate]
    if (holidaysStr === 'holiday') return true
    if (holidaysStr === 'work') return false
  } catch {}
  return false
}

function firstOfNextMonthFromPeriod(ym) {
  const [year, month] = String(ym || '').split('-').map((v) => Number(v))
  if (!year || !month) return ''

  const dt = new Date(year, month, 1)
  for (let i = 0; i < 10; i += 1) {
    const currentISO = toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    if (isWeekday(dt) && !isHolidayDate(currentISO)) return currentISO
    dt.setDate(dt.getDate() + 1)
  }

  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function firstBusinessDayOfNextMonth(iso) {
  if (!isISO(iso)) return ''

  const [year, month, day] = iso.split('-').map((v) => Number(v))
  const dt = new Date(year, month - 1, day)
  dt.setMonth(dt.getMonth() + 1)
  dt.setDate(1)

  for (let i = 0; i < 10; i += 1) {
    const currentISO = toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    if (isWeekday(dt) && !isHolidayDate(currentISO)) return currentISO
    dt.setDate(dt.getDate() + 1)
  }

  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function calculateVatPaymentDate(declarationDateISO) {
  if (!isISO(declarationDateISO)) return ''

  const [year, month] = declarationDateISO.split('-').map((x) => Number(x))
  const declarationQuarter = Math.ceil(Number(month) / 3)
  let nextQuarter = declarationQuarter + 1
  let nextYear = year

  if (nextQuarter > 4) {
    nextQuarter = 1
    nextYear = year + 1
  }

  const monthInQuarter = (nextQuarter - 1) * 3 + 2
  const paymentMonth = String(monthInQuarter).padStart(2, '0')
  return `${nextYear}-${paymentMonth}-05`
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
    window.addEventListener('urssafDataUpdated', handleDataChange)
    
    return () => {
      window.removeEventListener('invoicesUpdated', handleDataChange)
      window.removeEventListener('expensesUpdated', handleDataChange)
      window.removeEventListener('taxDataUpdated', handleDataChange)
      window.removeEventListener('treasuryUpdated', handleDataChange)
      window.removeEventListener('urssafDataUpdated', handleDataChange)
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

  const currentMonthKey = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const nextMonthKey = monthKeyFromISO(addMonthsISO(`${currentMonthKey}-01`, 1))

  const vatScheduledPayments = (() => {
    const years = new Set([
      curYear,
      ...Object.keys(taxData.byYear || {}).map((year) => Number(year)).filter(Boolean),
      ...invoices
        .map((inv) => Number(String(inv.paymentDate || inv.issueDate || '').slice(0, 4)))
        .filter(Boolean),
      ...expenses.map((exp) => Number(String(exp.date || '').slice(0, 4))).filter(Boolean),
    ])

    const rows = []

    for (const year of years) {
      let total = 0
      let janToJul = 0
      let augToDec = 0

      for (const inv of invoices) {
        if (inv.status !== 'paid') continue
        const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
        if (yearFromISO(paidDate) !== year) continue

        const month = Number(paidDate.slice(5, 7))
        const vat = invoiceTVA(inv, defaultTjm)
        total += vat
        if (month >= 1 && month <= 7) janToJul += vat
        if (month >= 8 && month <= 12) augToDec += vat
      }

      const deductible = round2(
        expenses
          .filter((exp) => yearFromISO(exp.date) === year)
          .reduce((sum, exp) => sum + vatFromTTC(exp.amount), 0)
      )

      const yearInfo = taxData.byYear?.[year] || {}
      const acompte1Calc = yearInfo.manualAcompte1 !== undefined && yearInfo.manualAcompte1 !== null
        ? Number(yearInfo.manualAcompte1)
        : round2(janToJul * ACOMPTES_RATE)
      const acompte2Calc = yearInfo.manualAcompte2 !== undefined && yearInfo.manualAcompte2 !== null
        ? Number(yearInfo.manualAcompte2)
        : round2(augToDec * ACOMPTES_RATE)

      if (acompte1Calc > 0 && !isISO(yearInfo.paidDateAcompte1)) {
        rows.push({
          source: 'TVA',
          label: `TVA acompte ${year}`,
          amount: round2(acompte1Calc),
          dueDate: `${year}-07-15`,
        })
      }

      if (acompte2Calc > 0 && !isISO(yearInfo.paidDateAcompte2)) {
        rows.push({
          source: 'TVA',
          label: `TVA acompte ${year}`,
          amount: round2(acompte2Calc),
          dueDate: `${year}-12-15`,
        })
      }

      const netDue = Math.max(round2(total) - deductible, 0)
      const declaredAmount = Number(yearInfo.declaredCa12Amount) || 0
      const declaredDueDate = calculateVatPaymentDate(String(yearInfo.declarationDate || '').trim())

      if (declaredAmount > 0 && declaredDueDate && !isISO(yearInfo.paidDate)) {
        rows.push({
          source: 'TVA',
          label: `TVA CA12 ${year}`,
          amount: round2(declaredAmount),
          dueDate: declaredDueDate,
        })
      } else if (year === curYear && netDue > 0 && !declaredDueDate) {
        // Pas de date exploitable tant que la déclaration CA12 n'est pas saisie.
      }
    }

    return rows.filter((row) => isISO(row.dueDate) && row.amount > 0)
  })()

  const urssafScheduledPayments = (() => {
    const grouped = new Map()

    for (const inv of invoices) {
      if (inv.status !== 'paid') continue
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!isISO(paidDate)) continue

      const ym = paidDate.slice(0, 7)
      const amountHT = invoiceHT(inv, defaultTjm)

      if (!grouped.has(ym)) {
        grouped.set(ym, {
          period: ym,
          revenueHT: 0,
        })
      }

      grouped.get(ym).revenueHT += amountHT
    }

    return Array.from(grouped.values())
      .map((row) => {
        const stored = urssafData.byPeriod?.[row.period] || {}
        const rate = Number(stored.rate)
        const effectiveRate = Number.isFinite(rate) && rate > 0
          ? rate
          : Number(urssafData.globalRate) || URSSAF_DEFAULT_RATE
        const declarationDate = String(stored.declarationDate || firstOfNextMonthFromPeriod(row.period))
        const dueDate = String(stored.expectedDebitDate || firstBusinessDayOfNextMonth(declarationDate) || '')
        const paidDate = String(stored.paidDate || '').trim()
        const amountDue = Math.round(((Number(row.revenueHT) || 0) * effectiveRate) / 100)

        return {
          source: 'URSSAF',
          label: `URSSAF ${row.period}`,
          amount: round2(amountDue),
          dueDate,
          paidDate,
        }
      })
      .filter((row) => row.amount > 0 && isISO(row.dueDate) && !isISO(row.paidDate))
  })()

  const paymentSummaryByMonth = (monthKey) => {
    const vat = round2(
      vatScheduledPayments
        .filter((row) => monthKeyFromISO(row.dueDate) === monthKey)
        .reduce((sum, row) => sum + row.amount, 0)
    )
    const urssaf = round2(
      urssafScheduledPayments
        .filter((row) => monthKeyFromISO(row.dueDate) === monthKey)
        .reduce((sum, row) => sum + row.amount, 0)
    )

    return {
      monthKey,
      label: monthLabel(monthKey),
      vat,
      urssaf,
      total: round2(vat + urssaf),
    }
  }

  const currentMonthPayments = paymentSummaryByMonth(currentMonthKey)
  const nextMonthPayments = paymentSummaryByMonth(nextMonthKey)

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

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}
          title={`${fmtEUR(currentMonthPayments.vat)} TVA + ${fmtEUR(currentMonthPayments.urssaf)} URSSAF`}
        >
          <div className="muted tiny" style={{ fontSize: 9, letterSpacing: 0.5 }}>
            🗓️ {currentMonthPayments.label}
          </div>
          <div className={`statusText ${currentMonthPayments.total > 0 ? 'statusWarn' : 'statusGood'}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtEUR(currentMonthPayments.total)}
          </div>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}
          title={`${fmtEUR(nextMonthPayments.vat)} TVA + ${fmtEUR(nextMonthPayments.urssaf)} URSSAF`}
        >
          <div className="muted tiny" style={{ fontSize: 9, letterSpacing: 0.5 }}>
            ⏭️ {nextMonthPayments.label}
          </div>
          <div className={`statusText ${nextMonthPayments.total > 0 ? 'statusWarn' : 'statusGood'}`} style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtEUR(nextMonthPayments.total)}
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

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
          <div className="muted small" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            🗓️ À payer en {currentMonthPayments.label}
          </div>
          <div className={`statusText ${currentMonthPayments.total > 0 ? 'statusWarn' : 'statusGood'}`} style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
            {fmtEUR(currentMonthPayments.total)}
          </div>
          <div className="muted small" style={{ fontSize: 10, marginTop: 4 }}>
            TVA {fmtEUR(currentMonthPayments.vat)} • URSSAF {fmtEUR(currentMonthPayments.urssaf)}
          </div>
        </div>

        <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
          <div className="muted small" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            ⏭️ À payer en {nextMonthPayments.label}
          </div>
          <div className={`statusText ${nextMonthPayments.total > 0 ? 'statusWarn' : 'statusGood'}`} style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
            {fmtEUR(nextMonthPayments.total)}
          </div>
          <div className="muted small" style={{ fontSize: 10, marginTop: 4 }}>
            TVA {fmtEUR(nextMonthPayments.vat)} • URSSAF {fmtEUR(nextMonthPayments.urssaf)}
          </div>
        </div>
      </div>
    </div>
  )
}
