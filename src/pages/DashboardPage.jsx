import React from 'react'
import {
  fmtEUR,
  invoiceHT,
  invoiceTTC,
  loadInvoices,
  loadSettingsLike,
  bcUsedDays,
  missionEndByQuota,
  invoiceTVA,
} from '../lib/invoices'
import { loadExpenses } from '../lib/expenses'

const SETTINGS_KEY = 'fact_settings_v3'
const TAX_STORAGE_KEY = 'fact_tax_rs_v1'
const URSSAF_KEY = 'fact_urssaf_v1'
const URSSAF_DEFAULT_RATE = 22
const DEFAULT_VAT_RATE = 20
const ACOMPTES_RATE = 0.8

function isISO(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').trim())
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

function calculateVatPaymentDate(declarationDateISO) {
  if (!declarationDateISO || !/^\d{4}-\d{2}-\d{2}$/.test(declarationDateISO)) return ''

  const [year, month] = declarationDateISO.split('-').map((x) => Number(x))
  const declarationMonth = Number(month)

  const declarationQuarter = Math.ceil(declarationMonth / 3)
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

function daysUntilISO(isoDate) {
  if (!isoDate) return null
  const target = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function formatDateFR(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

function loadUrssafData() {
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
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function vatFromTTC(ttc, rate = DEFAULT_VAT_RATE) {
  const amountTtc = Number(ttc) || 0
  const vatRate = Number(rate) || 0
  if (amountTtc <= 0 || vatRate <= 0) return 0
  return amountTtc - amountTtc / (1 + vatRate / 100)
}

function yearFromISO(iso) {
  const y = Number(String(iso || '').slice(0, 4))
  return Number.isFinite(y) ? y : 0
}

function loadVatData() {
  try {
    const raw = localStorage.getItem(TAX_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      selectedYear: Number(parsed?.selectedYear) || new Date().getFullYear(),
      byYear: parsed?.byYear && typeof parsed.byYear === 'object' ? parsed.byYear : {},
    }
  } catch {
    return {
      selectedYear: new Date().getFullYear(),
      byYear: {},
    }
  }
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

export default function DashboardPage() {
  const [settings, setSettings] = React.useState(() => loadSettingsLike(SETTINGS_KEY))
  const [invoices, setInvoices] = React.useState(() => loadInvoices())
  const [expenses, setExpenses] = React.useState(() => loadExpenses())
  const [vatData, setVatData] = React.useState(() => loadVatData())
  const [showBC, setShowBC] = React.useState(false)
  const [showAlerts, setShowAlerts] = React.useState(true)
  const [showDueInvoices, setShowDueInvoices] = React.useState(true)
  const [showRecentInvoices, setShowRecentInvoices] = React.useState(false)

  React.useEffect(() => {
    const handleInvoicesUpdate = () => setInvoices(loadInvoices())
    const handleExpensesUpdate = () => setExpenses(loadExpenses())
    const handleSettingsUpdate = () => setSettings(loadSettingsLike(SETTINGS_KEY))
    const handleTaxUpdate = () => setVatData(loadVatData())

    window.addEventListener('invoicesUpdated', handleInvoicesUpdate)
    window.addEventListener('expensesUpdated', handleExpensesUpdate)
    window.addEventListener('settingsUpdated', handleSettingsUpdate)
    window.addEventListener('taxDataUpdated', handleTaxUpdate)

    return () => {
      window.removeEventListener('invoicesUpdated', handleInvoicesUpdate)
      window.removeEventListener('expensesUpdated', handleExpensesUpdate)
      window.removeEventListener('settingsUpdated', handleSettingsUpdate)
      window.removeEventListener('taxDataUpdated', handleTaxUpdate)
    }
  }, [])

  const defaultTjm = Number(settings.tjmHt ?? 0) || 0
  const invoicesList = invoices
  const expensesList = expenses

  const missingParams = []
  if (!defaultTjm || defaultTjm <= 0) missingParams.push('TJM/Jour (parametres)')
  if (!settings.clientName) missingParams.push('Nom client (parametres)')
  if (!settings.missionStartDate) missingParams.push('Date debut mission (parametres)')

  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const paidInvoices = invoicesList.filter((inv) => inv.status === 'paid')
  const issuedInvoices = invoicesList.filter((inv) => inv.status !== 'paid')

  const invoicesThisMonth = paidInvoices
    .filter((inv) => {
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return false
      const y = Number(paidDate.slice(0, 4))
      const m = Number(paidDate.slice(5, 7))
      return y === curYear && m === curMonth
    })
    .reduce((sum, inv) => sum + invoiceTTC(inv, defaultTjm), 0)

  const expensesThisMonth = expensesList
    .filter((exp) => {
      const iso = String(exp.date || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
      const y = Number(iso.slice(0, 4))
      const m = Number(iso.slice(5, 7))
      return y === curYear && m === curMonth
    })
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

  const balance = invoicesThisMonth - expensesThisMonth
  const urssafData = loadUrssafData()

  const issuedAmountToCollect = issuedInvoices.reduce((sum, inv) => sum + invoiceTTC(inv, defaultTjm), 0)

  const overdueInvoices = issuedInvoices.filter((inv) => {
    const due = String(inv.dueDate || '').trim()
    return isISO(due) && due < todayISO
  })

  const paymentTermDays = Number(settings.paymentTermDays) > 0 ? Number(settings.paymentTermDays) : 60

  const unpaidInvoices = issuedInvoices
    .map((inv) => {
      const issueDate = String(inv.issueDate || '').trim()
      if (!isISO(issueDate)) return null

      const issue = new Date(`${issueDate}T00:00:00`)
      issue.setDate(issue.getDate() + paymentTermDays)
      const dueDate = `${issue.getFullYear()}-${String(issue.getMonth() + 1).padStart(2, '0')}-${String(issue.getDate()).padStart(2, '0')}`

      const daysUntil = daysUntilISO(dueDate)

      return {
        ...inv,
        calculatedDueDate: dueDate,
        daysUntilDue: daysUntil,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.daysUntilDue === null) return 1
      if (b.daysUntilDue === null) return -1
      return a.daysUntilDue - b.daysUntilDue
    })

  const ongoingBCs = (() => {
    const missionStartDate = String(settings.missionStartDate || '').trim()
    const missionStartISO = isISO(missionStartDate) ? missionStartDate : ''
    const currentPO = String(settings.purchaseOrder || '').trim()
    const quotaWorkdays = Number(settings.missionQuotaDays || 0) || 0

    const relevantInvoices = invoicesList.filter((inv) => {
      const po = String(inv.purchaseOrder || '').trim()
      if (!po) return false
      if (currentPO && po !== currentPO) return false
      const issueDate = String(inv.issueDate || '').trim()
      if (!isISO(issueDate)) return false
      if (missionStartISO && issueDate < missionStartISO) return false
      return true
    })

    const groupedByPO = new Map()

    for (const inv of relevantInvoices) {
      const po = String(inv.purchaseOrder || '').trim()
      const start = String(inv.issueDate || '').trim()
      if (!groupedByPO.has(po)) {
        groupedByPO.set(po, { invoices: [], startDate: missionStartISO || start })
      }

      const group = groupedByPO.get(po)
      group.invoices.push(inv)
    }

    if (currentPO && !groupedByPO.has(currentPO)) {
      groupedByPO.set(currentPO, { invoices: [], startDate: missionStartISO })
    }

    return Array.from(groupedByPO.entries())
      .map(([po, data]) => {
        const usedDays = bcUsedDays(relevantInvoices, po)
        const quota = quotaWorkdays > 0 ? quotaWorkdays : 0
        const remaining = Math.max(0, quota - usedDays)
        const percentUsed = quota > 0 ? Math.min(100, (usedDays / quota) * 100) : 0
        const estimatedEnd = quota > 0 && data.startDate && isISO(data.startDate) ? missionEndByQuota(data.startDate, quota) : ''
        const daysLeft = estimatedEnd ? daysUntilISO(estimatedEnd) : null

        return {
          po,
          usedDays,
          quota,
          remaining,
          percentUsed,
          estimatedEnd,
          daysLeft,
          invoiceCount: data.invoices.length,
          totalAmount: data.invoices.reduce((sum, inv) => sum + invoiceTTC(inv, defaultTjm), 0),
        }
      })
      .sort((a, b) => {
        if (a.daysLeft !== null && b.daysLeft !== null) {
          return a.daysLeft - b.daysLeft
        }
        return 0
      })
  })()

  const stats = [
    { label: 'Encaissements TTC (mois)', value: fmtEUR(invoicesThisMonth), tone: 'statusInfo' },
    { label: 'Depenses TTC (mois)', value: fmtEUR(expensesThisMonth), tone: 'statusDue' },
    { label: 'Solde mensuel', value: fmtEUR(balance), tone: balance >= 0 ? 'statusGood' : 'statusDue' },
    { label: 'Factures emises non payees', value: String(issuedInvoices.length), tone: issuedInvoices.length ? 'statusWarn' : 'statusGood' },
    { label: 'Montant a encaisser', value: fmtEUR(issuedAmountToCollect), tone: issuedAmountToCollect > 0 ? 'statusWarn' : 'statusGood' },
    { label: 'Factures en retard', value: String(overdueInvoices.length), tone: overdueInvoices.length ? 'statusDue' : 'statusGood', critical: overdueInvoices.length > 0 },
  ]

  const vatYear = curYear
  const yearVatData = vatData.byYear?.[vatYear] || {}

  const vatCollectedYear = React.useMemo(() => {
    let total = 0
    let janToJul = 0
    let augToDec = 0

    for (const inv of invoicesList) {
      if (inv.status !== 'paid') continue

      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (yearFromISO(paidDate) !== vatYear) continue

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
  }, [defaultTjm, vatYear, invoicesList])

  const vatDeductibleYear = round2(
    expensesList
      .filter((exp) => yearFromISO(exp.date) === vatYear)
      .reduce((sum, exp) => sum + vatFromTTC(exp.amount), 0)
  )

  const acompte1Auto = round2(vatCollectedYear.janToJul * ACOMPTES_RATE)
  const acompte2Auto = round2(vatCollectedYear.augToDec * ACOMPTES_RATE)

  const acompte1 = yearVatData.manualAcompte1 !== undefined && yearVatData.manualAcompte1 !== null
    ? Number(yearVatData.manualAcompte1)
    : acompte1Auto
  const acompte2 = yearVatData.manualAcompte2 !== undefined && yearVatData.manualAcompte2 !== null
    ? Number(yearVatData.manualAcompte2)
    : acompte2Auto
  const totalAcomptes = round2(acompte1 + acompte2)

  const vatNetDue = Math.max(vatCollectedYear.total - vatDeductibleYear, 0)
  const remainingToPay = Math.max(vatNetDue - totalAcomptes, 0)

  const tvaPayments = React.useMemo(() => {
    const payments = []

    const acompte1Paid = isISO(yearVatData.paidDateAcompte1 || '')
    const acompte2Paid = isISO(yearVatData.paidDateAcompte2 || '')

    if (acompte1 > 0 && !acompte1Paid) {
      const date1 = `${vatYear}-07-15`
      payments.push({
        label: 'Acompte 1 (juillet)',
        amount: acompte1,
        date: date1,
        daysUntil: daysUntilISO(date1),
        type: 'acompte1',
      })
    }

    if (acompte2 > 0 && !acompte2Paid) {
      const date2 = `${vatYear}-12-15`
      payments.push({
        label: 'Acompte 2 (decembre)',
        amount: acompte2,
        date: date2,
        daysUntil: daysUntilISO(date2),
        type: 'acompte2',
      })
    }

    const byYear = vatData.byYear || {}
    for (const [year, data] of Object.entries(byYear)) {
      const amount = Number(data?.declaredCa12Amount) || 0
      const declarationDate = String(data?.declarationDate || '').trim()
      const paidDate = String(data?.paidDate || '').trim()
      if (amount <= 0 || !isISO(declarationDate) || isISO(paidDate)) continue

      const paymentDate = calculateVatPaymentDate(declarationDate)
      if (!paymentDate) continue

      payments.push({
        label: `Solde TVA (CA12 ${year})`,
        amount,
        date: paymentDate,
        daysUntil: daysUntilISO(paymentDate),
        type: 'solde',
      })
    }

    if (
      remainingToPay > 0 &&
      yearVatData.declarationDate &&
      !(Number(yearVatData.declaredCa12Amount) > 0) &&
      !isISO(yearVatData.paidDate || '')
    ) {
      const soldeDate = calculateVatPaymentDate(yearVatData.declarationDate)
      if (soldeDate) {
        payments.push({
          label: `Solde TVA (CA12 ${vatYear})`,
          amount: remainingToPay,
          date: soldeDate,
          daysUntil: daysUntilISO(soldeDate),
          type: 'solde',
        })
      }
    }

    return payments.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [
    acompte1,
    acompte2,
    remainingToPay,
    vatYear,
    vatData.byYear,
    yearVatData.declarationDate,
    yearVatData.declaredCa12Amount,
    yearVatData.paidDate,
    yearVatData.paidDateAcompte1,
    yearVatData.paidDateAcompte2,
  ])

  const urssafMessage = (() => {
    const grouped = new Map()

    for (const inv of invoicesList) {
      if (inv.status !== 'paid') continue
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) continue

      const ym = paidDate.slice(0, 7)
      const amountHT = invoiceHT(inv, defaultTjm)
      grouped.set(ym, (grouped.get(ym) || 0) + amountHT)
    }

    const lines = Array.from(grouped.entries()).map(([period, revenueHT]) => {
      const stored = urssafData.byPeriod?.[period] || {}
      const rate = Number(stored.rate)
      const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : Number(urssafData.globalRate) || URSSAF_DEFAULT_RATE
      const declarationDate = String(stored.declarationDate || endOfMonthFromPeriod(period))
      const expectedDebitDate = String(stored.expectedDebitDate || addMonthsISO(declarationDate, 1))
      const paidDate = String(stored.paidDate || '')
      const amountDue = Math.round(((Number(revenueHT) || 0) * effectiveRate) / 100)

      return {
        period,
        amountDue,
        expectedDebitDate,
        paidDate,
      }
    })

    const remaining = lines.filter((l) => !l.paidDate).reduce((sum, l) => sum + l.amountDue, 0)
    if (remaining <= 0) return null

    const nextDue = lines
      .filter((l) => !l.paidDate && /^\d{4}-\d{2}-\d{2}$/.test(l.expectedDebitDate))
      .sort((a, b) => String(a.expectedDebitDate).localeCompare(String(b.expectedDebitDate)))[0]

    if (!nextDue) {
      return {
        text: `Reste a payer • ${fmtEUR(remaining)}`,
        tone: 'statusWarn',
      }
    }

    const d = daysUntilISO(nextDue.expectedDebitDate)
    if (d !== null && d < 0) {
      return {
        text: `URSSAF en retard (${Math.abs(d)} jour${Math.abs(d) > 1 ? 's' : ''}) • ${fmtEUR(nextDue.amountDue)} (Total: ${fmtEUR(remaining)})`,
        tone: 'statusDue',
      }
    }
    if (d !== null && d <= 30) {
      return {
        text: `Reste a payer dans ${d} jour${d > 1 ? 's' : ''} (${formatDateFR(nextDue.expectedDebitDate)}) • ${fmtEUR(nextDue.amountDue)} (Total: ${fmtEUR(remaining)})`,
        tone: 'statusWarn',
      }
    }

    return {
      text: `URSSAF prevue le ${formatDateFR(nextDue.expectedDebitDate)} • Reste ${fmtEUR(remaining)}`,
      tone: 'statusInfo',
    }
  })()

  return (
    <div className="section">
      {missingParams.length > 0 && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
            color: '#856404',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Parametres incomplets</div>
          <div>Merci de completer: {missingParams.join(', ')}</div>
        </div>
      )}

      <div className="kpiRow">
        {stats.map((stat) => (
          <div key={stat.label} className="kpi">
            <div className="label">{stat.label}</div>
            <div className={`kpiVal ${stat.tone}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="cardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Devis en cours (avancement)</span>
          <button className="btn" type="button" onClick={() => setShowBC((prev) => !prev)}>
            {showBC ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showBC && (
          <div className="cardBody">
            {ongoingBCs.length === 0 ? (
              <div className="muted small">Aucun devis en cours.</div>
            ) : (
              ongoingBCs.map((bc) => {
                const isOvertime = bc.daysLeft !== null && bc.daysLeft < 0
                const isWarning = bc.daysLeft !== null && bc.daysLeft >= 0 && bc.daysLeft <= 7
                const statusTone = isOvertime || isWarning ? 'statusDue' : bc.daysLeft !== null && bc.daysLeft <= 30 ? 'statusWarn' : 'statusInfo'
                const indicator = isOvertime ? '🔴 ' : isWarning ? '⚠️ ' : ''

                return (
                  <div key={bc.po} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{indicator}BC: {bc.po}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {bc.daysLeft === null ? '—' : bc.daysLeft < 0 ? `${Math.abs(bc.daysLeft)} jour${Math.abs(bc.daysLeft) > 1 ? 's' : ''} de retard` : `${bc.daysLeft} jour${bc.daysLeft > 1 ? 's' : ''} restants`}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 8, fontSize: 12 }}>
                      <div>
                        <div className="muted small">Avancement</div>
                        <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{bc.usedDays}/{bc.quota} jours ({Math.round(bc.percentUsed)}%)</div>
                      </div>
                      <div>
                        <div className="muted small">Factures emises</div>
                        <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{bc.invoiceCount} facture{bc.invoiceCount > 1 ? 's' : ''}</div>
                      </div>
                      <div>
                        <div className="muted small">Fin prevue</div>
                        <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{formatDateFR(bc.estimatedEnd)}</div>
                      </div>
                      <div>
                        <div className="muted small">Montant total TTC</div>
                        <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{fmtEUR(bc.totalAmount)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'block', height: 6, backgroundColor: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, bc.percentUsed)}%`,
                          backgroundColor: bc.percentUsed >= 100 ? 'var(--accent-3)' : bc.percentUsed >= 75 ? 'var(--accent-2)' : 'var(--accent)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                      {bc.remaining > 0 ? `${bc.remaining} jour${bc.remaining > 1 ? 's' : ''} a facturer` : 'Quota atteint'}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Alertes TVA / URSSAF</span>
          <button className="btn" type="button" onClick={() => setShowAlerts((prev) => !prev)}>
            {showAlerts ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showAlerts && (
          <div className="cardBody">
            <div className="label" style={{ marginBottom: 6 }}>TVA</div>
            {tvaPayments.length > 0 ? (
              <div>
                {tvaPayments.map((payment, idx) => {
                  const isOverdue = payment.daysUntil !== null && payment.daysUntil < 0
                  const isSoon = payment.daysUntil !== null && payment.daysUntil >= 0 && payment.daysUntil <= 30
                  const tone = isOverdue ? 'statusDue' : isSoon ? 'statusWarn' : 'statusInfo'
                  const indicator = isOverdue ? '🔴 ' : isSoon ? '⚠️ ' : ''
                  const daysText = payment.daysUntil === null ? '—' : payment.daysUntil < 0 ? `${Math.abs(payment.daysUntil)} j retard` : `${payment.daysUntil} j`

                  return (
                    <div key={idx} style={{ marginBottom: idx < tvaPayments.length - 1 ? 8 : 0, fontSize: 13 }}>
                      <span className={`statusText ${tone}`}>
                        {indicator}{payment.label} • {formatDateFR(payment.date)} ({daysText}) • <strong>{fmtEUR(payment.amount)}</strong>
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="muted small">Aucun paiement TVA configure. Complete les acomptes ou declaration CA12 dans la page Impots.</div>
            )}

            <div className="divider" style={{ margin: '12px 0' }} />

            <div className="label" style={{ marginBottom: 6 }}>URSSAF</div>
            {urssafMessage ? (
              <div className={`statusText ${urssafMessage.tone}`}>{urssafMessage.text}</div>
            ) : (
              <div className="muted small">Aucune alerte URSSAF a afficher.</div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Echeances factures ({paymentTermDays} jours)</span>
          <button className="btn" type="button" onClick={() => setShowDueInvoices((prev) => !prev)}>
            {showDueInvoices ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showDueInvoices && (
          <div className="cardBody">
            {unpaidInvoices.length === 0 ? (
              <div className="muted small">Aucune facture impayee.</div>
            ) : (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Client</th>
                      <th>Emission</th>
                      <th>Echeance</th>
                      <th>Jours restants</th>
                      <th>Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map((inv) => {
                      const d = inv.daysUntilDue
                      const isOverdue = d !== null && d < 0
                      const isCritical = d !== null && d >= 0 && d <= 7
                      const tone = isOverdue ? 'statusDue' : isCritical ? 'statusWarn' : 'statusInfo'
                      const indicator = isOverdue ? '🔴 ' : isCritical ? '⚠️ ' : ''
                      return (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 700 }}>{indicator}{inv.number || '—'}</td>
                          <td>{inv.clientName || '—'}</td>
                          <td>{formatDateFR(inv.issueDate)}</td>
                          <td>{formatDateFR(inv.calculatedDueDate)}</td>
                          <td>
                            <span className={`statusText ${tone}`}>
                              {d === null ? '—' : d < 0 ? `${Math.abs(d)} j retard` : `${d} j`}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{fmtEUR(invoiceTTC(inv, defaultTjm))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Dernieres factures</span>
          <button className="btn" type="button" onClick={() => setShowRecentInvoices((prev) => !prev)}>
            {showRecentInvoices ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {showRecentInvoices && (
          <div className="cardBody">
            {invoicesList.length === 0 ? (
              <div className="muted small">Aucune facture pour le moment</div>
            ) : (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Client</th>
                      <th>Statut</th>
                      <th>Emission</th>
                      <th>Paiement</th>
                      <th>TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...invoicesList]
                      .sort((a, b) => String(b.issueDate || '').localeCompare(String(a.issueDate || '')))
                      .slice(0, 8)
                      .map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 700 }}>{inv.number || '—'}</td>
                          <td>{inv.clientName || '—'}</td>
                          <td>
                            <span className={`statusText ${inv.status === 'paid' ? 'statusGood' : 'statusWarn'}`}>
                              {inv.status === 'paid' ? 'Payee' : 'Emise'}
                            </span>
                          </td>
                          <td>{formatDateFR(inv.issueDate)}</td>
                          <td>{formatDateFR(inv.paymentDate)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtEUR(invoiceTTC(inv, defaultTjm))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
