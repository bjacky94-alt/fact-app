import React from 'react'
import { fmtEUR, invoiceTVA, loadInvoices, loadSettingsLike } from '../lib/invoices'
import { loadExpenses } from '../lib/expenses'

const SETTINGS_KEY = 'fact_settings_v3'
const TAX_STORAGE_KEY = 'fact_tax_rs_v1'
const DEFAULT_VAT_RATE = 20
const ACOMPTES_RATE = 0.8

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function currentYear() {
  return new Date().getFullYear()
}

function loadTaxData() {
  try {
    const raw = localStorage.getItem(TAX_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      selectedYear: Number(parsed?.selectedYear) || currentYear(),
      byYear: parsed?.byYear && typeof parsed.byYear === 'object' ? parsed.byYear : {},
    }
  } catch {
    return {
      selectedYear: currentYear(),
      byYear: {},
    }
  }
}

function saveTaxData(data) {
  localStorage.setItem(TAX_STORAGE_KEY, JSON.stringify(data))
  // Déclencher un événement pour notifier les composants
  window.dispatchEvent(new CustomEvent('taxDataUpdated'))
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

function isISODate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').trim())
}

function isDateInRange(isoDate, startISO, endISO) {
  if (!isISODate(isoDate) || !isISODate(startISO) || !isISODate(endISO)) return false
  return isoDate >= startISO && isoDate <= endISO
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

function formatDateFR(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

function daysUntilISO(isoDate) {
  if (!isoDate) return null
  const target = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function calculateVatPaymentDate(declarationDateISO) {
  if (!declarationDateISO || !/^\d{4}-\d{2}-\d{2}$/.test(declarationDateISO)) return ''

  const [year, month] = declarationDateISO.split('-').map((x) => Number(x))
  const declarationMonth = Number(month)
  
  // Déterminer le trimestre de la déclaration (1-4)
  const declarationQuarter = Math.ceil(declarationMonth / 3)
  
  // Aller au trimestre suivant
  let nextQuarter = declarationQuarter + 1
  let nextYear = year
  
  if (nextQuarter > 4) {
    nextQuarter = 1
    nextYear = year + 1
  }
  
  // Déterminer le 2ème mois du trimestre suivant
  // Q1 (1-3) → 2ème mois = février (2)
  // Q2 (4-6) → 2ème mois = mai (5)
  // Q3 (7-9) → 2ème mois = août (8)
  // Q4 (10-12) → 2ème mois = novembre (11)
  const monthInQuarter = (nextQuarter - 1) * 3 + 2
  
  const paymentMonth = String(monthInQuarter).padStart(2, '0')
  return `${nextYear}-${paymentMonth}-05`
}

export default function TaxPage() {
  const [taxData, setTaxData] = React.useState(() => loadTaxData())
  const [newDeclaredYear, setNewDeclaredYear] = React.useState(() => currentYear())
  const [newDeclaredAmount, setNewDeclaredAmount] = React.useState('')
  const [newDeclarationDate, setNewDeclarationDate] = React.useState('')
  const [editingYear, setEditingYear] = React.useState(null)
  const [payingYear, setPayingYear] = React.useState(null)
  const [paymentDate, setPaymentDate] = React.useState('')

  const selectedYear = Number(taxData.selectedYear) || currentYear()
  const settings = loadSettingsLike(SETTINGS_KEY)
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0

  const yearData = taxData.byYear?.[selectedYear] || {
    declaredCa12Amount: 0,
    declarationDate: '',
  }

  const vatCollectedBreakdown = React.useMemo(() => {
    let total = 0
    let janToJul = 0
    let augToDec = 0
    const acompte1Start = `${selectedYear}-01-01`
    const acompte1End = `${selectedYear}-07-15`
    const acompte2Start = `${selectedYear}-07-16`
    const acompte2End = `${selectedYear}-12-15`

    for (const inv of loadInvoices()) {
      if (inv.status !== 'paid') continue

      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!isISODate(paidDate) || yearFromISO(paidDate) !== selectedYear) continue

      const vat = invoiceTVA(inv, defaultTjm)

      total += vat
      if (isDateInRange(paidDate, acompte1Start, acompte1End)) janToJul += vat
      if (isDateInRange(paidDate, acompte2Start, acompte2End)) augToDec += vat
    }

    return {
      total: round2(total),
      janToJul: round2(janToJul),
      augToDec: round2(augToDec),
    }
  }, [defaultTjm, selectedYear])

  const vatCollected = vatCollectedBreakdown.total

  const vatDeductible = React.useMemo(() => {
    return loadExpenses()
      .filter((exp) => yearFromISO(exp.date) === selectedYear)
      .reduce((sum, exp) => sum + vatFromTTC(exp.amount), 0)
  }, [selectedYear])

  const acompte1Auto = round2(vatCollectedBreakdown.janToJul * ACOMPTES_RATE)
  const acompte2Auto = round2(vatCollectedBreakdown.augToDec * ACOMPTES_RATE)
  
  // Utiliser les acomptes manuels si définis, sinon utiliser les acomptes automatiques
  const acompte1 = yearData.manualAcompte1 !== undefined && yearData.manualAcompte1 !== null 
    ? Number(yearData.manualAcompte1) 
    : acompte1Auto
  const acompte2 = yearData.manualAcompte2 !== undefined && yearData.manualAcompte2 !== null
    ? Number(yearData.manualAcompte2)
    : acompte2Auto
  const totalAcomptes = round2(acompte1 + acompte2)
  
  // Calculer le total des acomptes PAYÉS uniquement
  const acompte1Paid = /^\d{4}-\d{2}-\d{2}$/.test(yearData.paidDateAcompte1 || '') ? acompte1 : 0
  const acompte2Paid = /^\d{4}-\d{2}-\d{2}$/.test(yearData.paidDateAcompte2 || '') ? acompte2 : 0
  const totalAcomptesPaid = round2(acompte1Paid + acompte2Paid)

  const vatNetDue = Math.max(vatCollected - vatDeductible, 0)
  const vatCredit = Math.max(vatDeductible - vatCollected, 0)
  
  // Calculer le total des paiements TVA déjà effectués pour l'année sélectionnée
  const paidVatPayments = React.useMemo(() => {
    const yearInfo = taxData.byYear?.[selectedYear]
    if (!yearInfo) return 0
    
    const paidDate = String(yearInfo.paidDate || '').trim()
    const amount = Number(yearInfo.declaredCa12Amount) || 0
    
    // Si un paiement a été effectué pour cette année, le prendre en compte
    return /^\d{4}-\d{2}-\d{2}$/.test(paidDate) && amount > 0 ? amount : 0
  }, [taxData.byYear, selectedYear])
  
  const remainingToPay = Math.max(vatNetDue - totalAcomptesPaid - paidVatPayments, 0)
  const overpayment = Math.max(totalAcomptesPaid + paidVatPayments - vatNetDue, 0)

  // Calcul global pour savoir combien provisionner
  const globalVatCalculation = React.useMemo(() => {
    // 1. TVA restante de l'année sélectionnée (après acomptes PAYÉS)
    const currentYearVat = Math.max(vatNetDue - totalAcomptesPaid, 0)
    
    // 2. CA12 déclarés mais pas encore payés (toutes années)
    let totalUnpaidCA12 = 0
    const unpaidPayments = []
    const byYear = taxData.byYear || {}
    
    for (const [year, data] of Object.entries(byYear)) {
      const paidDate = String(data?.paidDate || '').trim()
      const amount = Number(data?.declaredCa12Amount) || 0
      const declarationDate = String(data?.declarationDate || '').trim()
      const paymentDate = calculateVatPaymentDate(declarationDate)
      
      if (amount > 0) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
          // Déclaré mais pas encore payé - à inclure dans la provision
          totalUnpaidCA12 += amount
          unpaidPayments.push({
            year: Number(year),
            amount,
            paymentDate,
          })
        }
      }
    }

    const totalToProvision = round2(currentYearVat + totalUnpaidCA12)

    return {
      vatCollected: round2(vatCollected),
      vatDeductible: round2(vatDeductible),
      vatNetDue: round2(vatNetDue),
      acomptes: round2(totalAcomptes),
      acomptesPaid: round2(totalAcomptesPaid),
      currentYearRemaining: round2(currentYearVat),
      unpaidCA12: round2(totalUnpaidCA12),
      unpaidPayments,
      toProvision: totalToProvision,
    }
  }, [vatCollected, vatDeductible, vatNetDue, totalAcomptes, totalAcomptesPaid, taxData.byYear])

  const upcomingPayments = React.useMemo(() => {
    const byYear = taxData.byYear || {}
    return Object.entries(byYear)
      .map(([year, data]) => {
        const amount = Number(data?.declaredCa12Amount) || 0
        const declarationDate = String(data?.declarationDate || '').trim()
        const paymentDate = calculateVatPaymentDate(declarationDate)
        const days = daysUntilISO(paymentDate)
        const paidDate = String(data?.paidDate || '').trim()

        return {
          year: Number(year),
          amount,
          declarationDate,
          paymentDate,
          paidDate,
          days,
        }
      })
      .filter((row) => row.amount > 0 && row.paymentDate)
      .sort((a, b) => String(a.paymentDate).localeCompare(String(b.paymentDate)))
  }, [taxData.byYear])

  const setYear = (year) => {
    const next = {
      ...taxData,
      selectedYear: Number(year) || currentYear(),
    }
    setTaxData(next)
    saveTaxData(next)
  }

  React.useEffect(() => {
    const y = Number(newDeclaredYear)
    if (!Number.isFinite(y)) return

    const existing = taxData.byYear?.[y]
    if (!existing) return

    const amount = Number(existing.declaredCa12Amount) || 0
    const date = String(existing.declarationDate || '')

    if (amount > 0) setNewDeclaredAmount(String(amount))
    if (date) setNewDeclarationDate(date)
  }, [newDeclaredYear, taxData.byYear])

  // Calculer et pré-remplir le solde TVA restant à payer pour l'année sélectionnée
  React.useEffect(() => {
    const y = Number(newDeclaredYear)
    if (!Number.isFinite(y)) return

    const existing = taxData.byYear?.[y]
    
    // Si on ne modifie pas un paiement existant, calculer le solde automatiquement
    if (!existing || (existing && !existing.declaredCa12Amount)) {
      // Calculer TVA pour cette année
      let vatTotal = 0
      let janToJul = 0
      let augToDec = 0
      const acompte1Start = `${y}-01-01`
      const acompte1End = `${y}-07-15`
      const acompte2Start = `${y}-07-16`
      const acompte2End = `${y}-12-15`

      for (const inv of loadInvoices()) {
        if (inv.status !== 'paid') continue
        const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
        if (!isISODate(paidDate) || yearFromISO(paidDate) !== y) continue

        const vat = invoiceTVA(inv, defaultTjm)

        vatTotal += vat
        if (isDateInRange(paidDate, acompte1Start, acompte1End)) janToJul += vat
        if (isDateInRange(paidDate, acompte2Start, acompte2End)) augToDec += vat
      }

      // Calculer TVA déductible
      let vatDeductibleTemp = 0
      for (const exp of loadExpenses()) {
        if (yearFromISO(exp.date) === y) {
          vatDeductibleTemp += vatFromTTC(exp.amount)
        }
      }

      // Calculer acomptes
      const acompte1Auto = round2(janToJul * ACOMPTES_RATE)
      const acompte2Auto = round2(augToDec * ACOMPTES_RATE)
      
      const yearTempData = taxData.byYear?.[y] || {}
      const acompte1 = yearTempData.manualAcompte1 !== undefined && yearTempData.manualAcompte1 !== null 
        ? Number(yearTempData.manualAcompte1) 
        : acompte1Auto
      const acompte2 = yearTempData.manualAcompte2 !== undefined && yearTempData.manualAcompte2 !== null
        ? Number(yearTempData.manualAcompte2)
        : acompte2Auto

      // Calculer le solde restant
      const vatNetDueTemp = Math.max(vatTotal - vatDeductibleTemp, 0)
      const totalAcomptesTemp = round2(acompte1 + acompte2)
      const remainingToPayTemp = Math.max(vatNetDueTemp - totalAcomptesTemp, 0)

      setNewDeclaredAmount(String(remainingToPayTemp > 0 ? remainingToPayTemp : ''))
    }
  }, [newDeclaredYear, defaultTjm, taxData.byYear])

  const addDeclaredPayment = () => {
    const year = Number(newDeclaredYear)
    const amount = Number(String(newDeclaredAmount).replace(',', '.'))
    const date = String(newDeclarationDate || '').trim()

    if (!Number.isFinite(year) || year < 2000 || year > 2100) return
    if (!Number.isFinite(amount) || amount <= 0) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const current = taxData.byYear?.[year] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [year]: {
          ...current,
          declaredCa12Amount: amount,
          declarationDate: date,
        },
      },
    }

    setTaxData(next)
    saveTaxData(next)
    setEditingYear(null)
    setNewDeclaredAmount('')
    setNewDeclarationDate('')
    setNewDeclaredYear(year)
  }

  const editDeclaredPayment = (year, amount, declarationDate) => {
    setEditingYear(Number(year))
    setNewDeclaredYear(Number(year))
    setNewDeclaredAmount(String(amount || ''))
    setNewDeclarationDate(String(declarationDate || ''))
  }

  const deleteDeclaredPayment = (year) => {
    const y = Number(year)
    const current = taxData.byYear?.[y]
    if (!current) return

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [y]: {
          ...current,
          declaredCa12Amount: 0,
          declarationDate: '',
        },
      },
    }

    setTaxData(next)
    saveTaxData(next)

    if (Number(editingYear) === y) {
      setEditingYear(null)
      setNewDeclaredAmount('')
      setNewDeclarationDate('')
      setNewDeclaredYear(currentYear())
    }
  }

  const updateAcompte = (acompteNumber, value) => {
    const amount = Number(String(value).replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) return

    const current = taxData.byYear?.[selectedYear] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const field = acompteNumber === 1 ? 'manualAcompte1' : 'manualAcompte2'

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [selectedYear]: {
          ...current,
          [field]: amount,
        },
      },
    }

    setTaxData(next)
    saveTaxData(next)
  }

  const resetAcompte = (acompteNumber) => {
    const current = taxData.byYear?.[selectedYear] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const field = acompteNumber === 1 ? 'manualAcompte1' : 'manualAcompte2'
    const { [field]: _, ...rest } = current

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [selectedYear]: rest,
      },
    }

    setTaxData(next)
    saveTaxData(next)
  }

  const payAcompte = (acompteNumber, date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const current = taxData.byYear?.[selectedYear] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const field = acompteNumber === 1 ? 'paidDateAcompte1' : 'paidDateAcompte2'

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [selectedYear]: {
          ...current,
          [field]: date,
        },
      },
    }

    setTaxData(next)
    saveTaxData(next)
  }

  const cancelAcomptePayment = (acompteNumber) => {
    const current = taxData.byYear?.[selectedYear] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const field = acompteNumber === 1 ? 'paidDateAcompte1' : 'paidDateAcompte2'
    const { [field]: _, ...rest } = current

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [selectedYear]: rest,
      },
    }

    setTaxData(next)
    saveTaxData(next)
  }

  const markAsPaid = () => {
    const year = Number(payingYear)
    if (!Number.isFinite(year)) return
    const date = String(paymentDate || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const current = taxData.byYear?.[year] || {
      declaredCa12Amount: 0,
      declarationDate: '',
    }

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [year]: {
          ...current,
          paidDate: date,
        },
      },
    }

    setTaxData(next)
    saveTaxData(next)
    setPayingYear(null)
    setPaymentDate('')
  }

  const cancelPayment = (year) => {
    const y = Number(year)
    const current = taxData.byYear?.[y]
    if (!current) return

    const { paidDate: _, ...rest } = current

    const next = {
      ...taxData,
      byYear: {
        ...(taxData.byYear || {}),
        [y]: rest,
      },
    }

    setTaxData(next)
    saveTaxData(next)
  }

  return (
    <div className="section">
      <div className="card">
        <div className="cardHeader">Paiements TVA à venir (toutes années)</div>
        <div className="cardBody section">
          <div className="grid2">
            <div className="field">
              <div className="label">Exercice concerné</div>
              <input
                className="input"
                type="number"
                min="2000"
                max="2100"
                value={newDeclaredYear}
                onChange={(e) => setNewDeclaredYear(Number(e.target.value) || currentYear())}
              />
            </div>

            <div className="field">
              <div className="label">Montant CA12 déclaré</div>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={newDeclaredAmount}
                onChange={(e) => setNewDeclaredAmount(e.target.value)}
              />
            </div>

            <div className="field">
              <div className="label">Date de déclaration</div>
              <input
                className="input"
                type="date"
                value={newDeclarationDate}
                onChange={(e) => setNewDeclarationDate(e.target.value)}
              />
            </div>
          </div>

          <button className="btnPrimary" type="button" onClick={addDeclaredPayment}>
            {editingYear ? `Enregistrer la modification (${editingYear})` : 'Ajouter le paiement à venir'}
          </button>

          {upcomingPayments.length === 0 ? (
            <div className="muted small">Aucun paiement TVA à venir enregistré.</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Exercice</th>
                    <th>Montant à payer</th>
                    <th>Déclarée le</th>
                    <th>Prélèvement estimé</th>
                    <th>Payée le</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingPayments.map((row) => {
                    const yearTaxData = taxData.byYear?.[row.year] || {}
                    const paidDate = String(yearTaxData.paidDate || '').trim()
                    const isPaid = /^\d{4}-\d{2}-\d{2}$/.test(paidDate)
                    
                    const isLate = !isPaid && Number(row.days) < 0
                    const isSoon = !isPaid && Number(row.days) >= 0 && Number(row.days) <= 30
                    const toneClass = isPaid ? 'statusGood' : isLate ? 'statusDue' : isSoon ? 'statusWarn' : 'statusInfo'
                    const statusText = isPaid
                      ? `Payée`
                      : isLate
                        ? `En retard (${Math.abs(Number(row.days))} j)`
                        : isSoon
                          ? `À venir (${Number(row.days)} j)`
                          : 'Planifié'

                    return (
                      <tr key={`${row.year}-${row.declarationDate}-${row.amount}`}>
                        <td>{row.year}</td>
                        <td className={toneClass} style={{ fontWeight: 800 }}>{fmtEUR(row.amount)}</td>
                        <td>{formatDateFR(row.declarationDate)}</td>
                        <td>{formatDateFR(row.paymentDate)}</td>
                        <td>{isPaid ? formatDateFR(paidDate) : '—'}</td>
                        <td><span className={`statusText ${toneClass}`}>{statusText}</span></td>
                        <td>
                          <div className="actions">
                            {!isPaid && (
                              <button
                                className="btn"
                                type="button"
                                onClick={() => {
                                  setPayingYear(row.year)
                                  setPaymentDate('')
                                }}
                              >
                                Payer
                              </button>
                            )}
                            {isPaid && (
                              <button
                                className="btn"
                                type="button"
                                onClick={() => cancelPayment(row.year)}
                              >
                                Annuler paiement
                              </button>
                            )}
                            <button
                              className="btn"
                              type="button"
                              onClick={() => editDeclaredPayment(row.year, row.amount, row.declarationDate)}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => deleteDeclaredPayment(row.year)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="muted small">
            Règle appliquée: date de prélèvement estimée = date de déclaration + 2 mois.
          </div>

          {payingYear && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--accent)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Enregistrer le paiement TVA {payingYear}</div>
              <div className="field">
                <div className="label">Date de paiement réelle</div>
                <input
                  className="input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btnPrimary" type="button" onClick={markAsPaid}>
                  Enregistrer le paiement
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setPayingYear(null)
                    setPaymentDate('')
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Impôts • TVA réel simplifié</div>
        <div className="cardBody section">
          <div className="grid2">
            <div className="field">
              <div className="label">Exercice</div>
              <input
                className="input"
                type="number"
                min="2000"
                max="2100"
                value={selectedYear}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="muted small">
            Fonctionnement inspiré des écrans TVA de logiciels de gestion: 2 acomptes (juillet/décembre),
            CA12 annuel puis solde restant. Acomptes calculés automatiquement à 80% de la TVA des périodes concernées.
          </div>

          <div className="divider" />

          <div className="kpiRow">
            <div className="kpi">
              <div className="label">TVA collectée</div>
              <div className="kpiVal">{fmtEUR(vatCollected)}</div>
            </div>
            <div className="kpi">
              <div className="label">TVA déductible</div>
              <div className="kpiVal">{fmtEUR(vatDeductible)}</div>
            </div>
            <div className="kpi">
              <div className="label">TVA nette CA12</div>
              <div className="kpiVal">{fmtEUR(vatNetDue)}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="label" style={{ marginBottom: 12, fontWeight: 700 }}>Récapitulatif paiements TVA pour {selectedYear}</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16, fontSize: 13 }}>
            <div style={{ padding: 10, backgroundColor: 'var(--surface2)', borderRadius: 6, position: 'relative' }}>
              <div className="muted small">Acompte 1 (15 juillet)</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{fmtEUR(acompte1)}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {yearData.manualAcompte1 !== undefined && yearData.manualAcompte1 !== null ? 'Manuel' : `Auto (80% 01/01→15/07: ${fmtEUR(acompte1Auto)})`}
              </div>
              {acompte1Paid > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <span className="statusText statusGood" style={{ fontSize: 11 }}>✓ Payé le {formatDateFR(yearData.paidDateAcompte1)}</span>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => cancelAcomptePayment(1)}
                    style={{ marginTop: 4, fontSize: 11, padding: '4px 8px' }}
                  >
                    Annuler paiement
                  </button>
                </div>
              ) : (
                <button
                  className="btnPrimary"
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    payAcompte(1, today)
                  }}
                  style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }}
                >
                  Marquer comme payé
                </button>
              )}
            </div>
            <div style={{ padding: 10, backgroundColor: 'var(--surface2)', borderRadius: 6, position: 'relative' }}>
              <div className="muted small">Acompte 2 (15 décembre)</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{fmtEUR(acompte2)}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {yearData.manualAcompte2 !== undefined && yearData.manualAcompte2 !== null ? 'Manuel' : `Auto (80% 16/07→15/12: ${fmtEUR(acompte2Auto)})`}
              </div>
              {acompte2Paid > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <span className="statusText statusGood" style={{ fontSize: 11 }}>✓ Payé le {formatDateFR(yearData.paidDateAcompte2)}</span>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => cancelAcomptePayment(2)}
                    style={{ marginTop: 4, fontSize: 11, padding: '4px 8px' }}
                  >
                    Annuler paiement
                  </button>
                </div>
              ) : (
                <button
                  className="btnPrimary"
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    payAcompte(2, today)
                  }}
                  style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }}
                >
                  Marquer comme payé
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Acomptes TVA</div>
        <div className="cardBody section">
          <div className="grid2">
            <div className="field">
              <div className="label">
                Acompte 1 (01/01 → 15/07)
                {yearData.manualAcompte1 !== undefined && yearData.manualAcompte1 !== null ? (
                  <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                    • manuel
                    <button
                      type="button"
                      onClick={() => resetAcompte(1)}
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: '2px 6px',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: 'var(--surface2)',
                        cursor: 'pointer'
                      }}
                    >
                      Réinitialiser
                    </button>
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)', marginLeft: 8 }}>• auto ({fmtEUR(acompte1Auto)})</span>
                )}
              </div>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={acompte1}
                onChange={(e) => updateAcompte(1, e.target.value)}
              />
              <div className="muted small" style={{ marginTop: 4 }}>📅 À payer le 15 juillet {selectedYear}</div>
            </div>
            <div className="field">
              <div className="label">
                Acompte 2 (16/07 → 15/12)
                {yearData.manualAcompte2 !== undefined && yearData.manualAcompte2 !== null ? (
                  <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                    • manuel
                    <button
                      type="button"
                      onClick={() => resetAcompte(2)}
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: '2px 6px',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: 'var(--surface2)',
                        cursor: 'pointer'
                      }}
                    >
                      Réinitialiser
                    </button>
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)', marginLeft: 8 }}>• auto ({fmtEUR(acompte2Auto)})</span>
                )}
              </div>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={acompte2}
                onChange={(e) => updateAcompte(2, e.target.value)}
              />
              <div className="muted small" style={{ marginTop: 4 }}>📅 À payer le 15 décembre {selectedYear}</div>
            </div>
          </div>

          <div className="kpiRow">
            <div className="kpi">
              <div className="label">Total acomptes</div>
              <div className="kpiVal">{fmtEUR(totalAcomptes)}</div>
            </div>
            <div className="kpi">
              <div className="label">Acomptes payés</div>
              <div className="kpiVal">{fmtEUR(totalAcomptesPaid)}</div>
            </div>
            <div className="kpi">
              <div className="label">Acomptes restants</div>
              <div className="kpiVal">{fmtEUR(totalAcomptes - totalAcomptesPaid)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">CA12 • Solde</div>
        <div className="cardBody section">
          <div className="tableWrap">
            <table className="table">
              <tbody>
                <tr>
                  <td>TVA collectée</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtEUR(vatCollected)}</td>
                </tr>
                <tr>
                  <td>TVA déductible</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>- {fmtEUR(vatDeductible)}</td>
                </tr>
                <tr>
                  <td>TVA nette à payer avant acomptes</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtEUR(vatNetDue)}</td>
                </tr>
                <tr>
                  <td>Acomptes payés (juillet + décembre)</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>- {fmtEUR(totalAcomptesPaid)}</td>
                </tr>
                {paidVatPayments > 0 && (
                  <tr>
                    <td>Paiements TVA CA12 déjà effectués</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>- {fmtEUR(paidVatPayments)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontWeight: 900 }}>Solde restant à payer</td>
                  <td style={{ textAlign: 'right', fontWeight: 900 }}>{fmtEUR(remainingToPay)}</td>
                </tr>
                <tr>
                  <td>Crédit de TVA éventuel</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtEUR(vatCredit + overpayment)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {yearData.declarationDate && (
            <div style={{ marginTop: 12, padding: 10, backgroundColor: 'var(--surface2)', borderRadius: 6, fontSize: 12 }}>
              <div className="muted small">📅 Déclaration CA12 du {formatDateFR(yearData.declarationDate)}</div>
              <div style={{ marginTop: 4 }}>Paiement du solde estimé le: <strong>{formatDateFR(calculateVatPaymentDate(yearData.declarationDate))}</strong></div>
              {remainingToPay > 0 && (
                <div style={{ marginTop: 4, color: 'var(--accent)' }}>Montant du solde: <strong>{fmtEUR(remainingToPay)}</strong></div>
              )}
            </div>
          )}

          <div className="muted small" style={{ marginTop: 10 }}>
            Formule appliquée: acompte 1 = 80% de la TVA (factures payées du 01/01 au 15/07), acompte 2 = 80% de la TVA (factures payées du 16/07 au 15/12), puis Solde = TVA nette − acomptes.
          </div>
        </div>
      </div>

    </div>
  )
}
