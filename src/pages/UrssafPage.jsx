import React from 'react'
import { fmtEUR, invoiceHT, loadInvoices, loadSettingsLike } from '../lib/invoices'

const SETTINGS_KEY = 'fact_settings_v3'
const URSSAF_KEY = 'fact_urssaf_v1'
const DEFAULT_RATE = 22

// Importer les fonctions utilitaires pour les jours ouvrés
// Copier les mêmes fonctions de invoices.js ici pour éviter les dépendances circulaires
function isWeekday(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function isHolidayDate(isoDate) {
  // Récupérer les jours fériés depuis invoices via une clé cache
  try {
    const cache = JSON.parse(localStorage.getItem('_holidays_cache') || '{}')
    const holidaysStr = cache[isoDate]
    if (holidaysStr === 'holiday') return true
    if (holidaysStr === 'work') return false
  } catch {}
  return false
}

function currentISODate() {
  return new Date().toISOString().split('T')[0]
}

function parseISOToParts(iso) {
  const raw = String(iso || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map((v) => Number(v))
  return { year, month, day }
}

function toISO(year, month, day) {
  const yyyy = String(year)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function endOfMonthFromPeriod(ym) {
  const [year, month] = String(ym || '').split('-').map((v) => Number(v))
  if (!year || !month) return ''
  const dt = new Date(year, month, 0)
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function addMonths(iso, months) {
  const parts = parseISOToParts(iso)
  if (!parts) return ''
  const dt = new Date(parts.year, parts.month - 1, parts.day)
  dt.setMonth(dt.getMonth() + Number(months || 0))
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function firstOfNextMonthFromPeriod(ym) {
  // Retourner le 1er jour ouvré du mois suivant la période (YYYY-MM)
  const [year, month] = String(ym || '').split('-').map((v) => Number(v))
  if (!year || !month) return ''
  
  // Créer date du 1er du mois suivant
  const dt = new Date(year, month, 1) // Month est 0-indexed, donc month+1 donne le mois suivant
  
  // Chercher le 1er jour ouvré
  for (let i = 0; i < 10; i++) {
    const currentISO = toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    if (isWeekday(dt) && !isHolidayDate(currentISO)) {
      return currentISO
    }
    dt.setDate(dt.getDate() + 1)
  }
  
  // Fallback si pas trouvé
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function nextBusinessDay(iso) {
  // Trouver le prochain jour ouvré après la date donnée
  const parts = parseISOToParts(iso)
  if (!parts) return iso
  
  const dt = new Date(parts.year, parts.month - 1, parts.day)
  
  // Ajouter 1 jour
  dt.setDate(dt.getDate() + 1)
  
  // Chercher le prochain jour ouvré (weekday ET not holiday)
  for (let i = 0; i < 10; i++) {
    const currentISO = toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    if (isWeekday(dt) && !isHolidayDate(currentISO)) {
      return currentISO
    }
    dt.setDate(dt.getDate() + 1)
  }
  
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function firstBusinessDayOfNextMonth(iso) {
  // Retourner le 1er jour ouvré du mois suivant la date donnée
  const parts = parseISOToParts(iso)
  if (!parts) return iso
  
  const dt = new Date(parts.year, parts.month - 1, parts.day)
  
  // Aller au 1er du mois suivant
  dt.setMonth(dt.getMonth() + 1)
  dt.setDate(1)
  
  // Chercher le 1er jour ouvré
  for (let i = 0; i < 10; i++) {
    const currentISO = toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    if (isWeekday(dt) && !isHolidayDate(currentISO)) {
      return currentISO
    }
    dt.setDate(dt.getDate() + 1)
  }
  
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function formatPeriod(ym) {
  const [year, month] = String(ym).split('-').map((v) => Number(v))
  if (!year || !month) return ym
  const dt = new Date(year, month - 1, 1)
  return dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function formatDateFR(iso) {
  const parts = parseISOToParts(iso)
  if (!parts) return '—'
  const d = new Date(parts.year, parts.month - 1, parts.day)
  return d.toLocaleDateString('fr-FR')
}

function roundEUR(value) {
  return Math.round(Number(value) || 0)
}

function loadUrssafData() {
  try {
    const raw = localStorage.getItem(URSSAF_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      globalRate: Number(parsed?.globalRate) > 0 ? Number(parsed.globalRate) : DEFAULT_RATE,
      byPeriod: parsed?.byPeriod && typeof parsed.byPeriod === 'object' ? parsed.byPeriod : {},
    }
  } catch {
    return {
      globalRate: DEFAULT_RATE,
      byPeriod: {},
    }
  }
}

function saveUrssafData(data) {
  localStorage.setItem(URSSAF_KEY, JSON.stringify(data))
}

export default function UrssafPage() {
  const [urssafData, setUrssafData] = React.useState(() => loadUrssafData())
  const [statusFilter, setStatusFilter] = React.useState('all')

  const settings = loadSettingsLike(SETTINGS_KEY)
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0

  const lines = React.useMemo(() => {
    const grouped = new Map()
    const paidInvoices = loadInvoices().filter((inv) => inv.status === 'paid')

    for (const inv of paidInvoices) {
      const paidDate = String(inv.paymentDate || inv.issueDate || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) continue

      const ym = paidDate.slice(0, 7)
      const amountHT = invoiceHT(inv, defaultTjm)

      if (!grouped.has(ym)) {
        grouped.set(ym, {
          key: ym,
          period: ym,
          revenueHT: 0,
        })
      }

      const item = grouped.get(ym)
      item.revenueHT += amountHT
    }

    const rows = Array.from(grouped.values())
      .sort((a, b) => String(b.period).localeCompare(String(a.period)))
      .map((row) => {
        const stored = urssafData.byPeriod?.[row.key] || {}
        const rate = Number(stored.rate)
        const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : Number(urssafData.globalRate) || DEFAULT_RATE

        // Date de déclaration = 1er jour ouvré du mois suivant la période
        const defaultDeclarationDate = firstOfNextMonthFromPeriod(row.period)
        const declarationDate = String(stored.declarationDate || defaultDeclarationDate)
        
        // Date de prélèvement prévu = 1er jour ouvré du mois suivant la déclaration (1 mois après)
        const defaultDebitDate = firstBusinessDayOfNextMonth(declarationDate)
        const expectedDebitDate = String(stored.expectedDebitDate || defaultDebitDate || '')
        const paidDate = String(stored.paidDate || '')

        const amountDue = roundEUR((row.revenueHT * effectiveRate) / 100)

        return {
          ...row,
          revenueHT: roundEUR(row.revenueHT),
          rate: effectiveRate,
          declarationDate,
          expectedDebitDate,
          paidDate,
          amountDue,
        }
      })

    return rows
  }, [defaultTjm, urssafData])

  const totalDue = lines.reduce((sum, l) => sum + l.amountDue, 0)
  const totalPaid = lines.filter((l) => !!l.paidDate).reduce((sum, l) => sum + l.amountDue, 0)
  const totalRemaining = Math.max(totalDue - totalPaid, 0)

  const filteredLines = React.useMemo(() => {
    if (statusFilter === 'paid') return lines.filter((line) => !!line.paidDate)
    if (statusFilter === 'due') return lines.filter((line) => !line.paidDate)
    return lines
  }, [lines, statusFilter])

  const persist = (next) => {
    setUrssafData(next)
    saveUrssafData(next)
  }

  const updateGlobalRate = (value) => {
    const num = Number(String(value).replace(',', '.'))
    const safe = Number.isFinite(num) && num > 0 ? num : DEFAULT_RATE
    persist({
      ...urssafData,
      globalRate: safe,
    })
  }

  const updateLine = (key, patch) => {
    const current = urssafData.byPeriod?.[key] || {}
    persist({
      ...urssafData,
      byPeriod: {
        ...(urssafData.byPeriod || {}),
        [key]: {
          ...current,
          ...patch,
        },
      },
    })
  }

  const markPaidToday = (key) => {
    updateLine(key, { paidDate: currentISODate() })
  }

  const unmarkPaid = (key) => {
    updateLine(key, { paidDate: '' })
  }

  return (
    <div className="section">
      <div className="kpiRow">
        <div className="kpi">
          <div className="label">Cotisations URSSAF (arrondies)</div>
          <div className="kpiVal">{fmtEUR(totalDue)}</div>
        </div>
        <div className="kpi">
          <div className="label">Déjà payées</div>
          <div className="kpiVal">{fmtEUR(totalPaid)}</div>
        </div>
        <div className="kpi">
          <div className="label">Reste à payer</div>
          <div className="kpiVal">{fmtEUR(totalRemaining)}</div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">URSSAF</div>
        <div className="cardBody section">
          <div className="grid2" style={{ gridTemplateColumns: 'minmax(220px,260px) minmax(220px,260px)' }}>
            <div className="field" style={{ maxWidth: 260 }}>
              <div className="label">Taux global de prélèvement (%)</div>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={urssafData.globalRate}
                onChange={(e) => updateGlobalRate(e.target.value)}
              />
            </div>

            <div className="field" style={{ maxWidth: 260 }}>
              <div className="label">Filtrer les lignes</div>
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Toutes</option>
                <option value="due">À payer</option>
                <option value="paid">Payées</option>
              </select>
            </div>
          </div>

          <div className="muted small">
            Les lignes sont générées à partir des factures marquées payées. Le montant est arrondi à l'euro.
            La date de déclaration est automatiquement fixée au 1er jour ouvré du mois suivant le paiement. La date de prélèvement est automatiquement calculée au 1er jour ouvré du mois suivant la déclaration (1 mois après).
            Le taux peut être ajusté globalement puis modifié individuellement par ligne.
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Période</th>
                  <th>CA encaissé HT</th>
                  <th>Taux (%)</th>
                  <th>Cotisation due</th>
                  <th>Date de déclaration</th>
                  <th>Date de prélèvement prévu</th>
                  <th>Statut paiement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      Aucune ligne pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => (
                    <tr key={line.key}>
                      <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{formatPeriod(line.period)}</td>
                      <td>{fmtEUR(line.revenueHT)}</td>
                      <td style={{ width: 120 }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => {
                            const num = Number(String(e.target.value).replace(',', '.'))
                            const safe = Number.isFinite(num) && num > 0 ? num : 0
                            updateLine(line.key, { rate: safe })
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 800 }}>{fmtEUR(line.amountDue)}</td>
                      <td style={{ width: 170 }}>
                        <input
                          className="input"
                          type="date"
                          value={line.declarationDate}
                          onChange={(e) => {
                            const nextDeclarationDate = String(e.target.value || '')
                            // Calculer le 1er jour ouvré du mois suivant la déclaration
                            const autoDebitDate = firstBusinessDayOfNextMonth(nextDeclarationDate)
                            updateLine(line.key, {
                              declarationDate: nextDeclarationDate,
                              expectedDebitDate: autoDebitDate,
                            })
                          }}
                        />
                      </td>
                      <td style={{ width: 170 }}>
                        <input
                          className="input"
                          type="date"
                          value={line.expectedDebitDate}
                          onChange={(e) => updateLine(line.key, { expectedDebitDate: e.target.value })}
                        />
                      </td>
                      <td>
                        {line.paidDate ? (
                          <span className="statusText statusGood">Payé le {formatDateFR(line.paidDate)}</span>
                        ) : (
                          <span className="statusText statusWarn">À payer</span>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          {line.paidDate ? (
                            <button className="btn" type="button" onClick={() => unmarkPaid(line.key)}>
                              Annuler
                            </button>
                          ) : (
                            <button className="btnPrimary" type="button" onClick={() => markPaidToday(line.key)}>
                              Marquer payé
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
