import React from 'react'
import { Download, FileText, RefreshCw, Trash2 } from 'lucide-react'
import { downloadQuotePdf } from '../lib/quotePdf'
import { fmtEUR, loadSettingsLike } from '../lib/invoices'

const SETTINGS_KEY = 'fact_settings_v3'
const QUOTES_HISTORY_KEY = 'fact_quotes_history_v1'

function loadQuotesHistory() {
  try {
    const raw = localStorage.getItem(QUOTES_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQuotesHistory(history) {
  localStorage.setItem(QUOTES_HISTORY_KEY, JSON.stringify(history || []))
}

function computeQuoteTotalsFromDraft(quoteDraft) {
  const totalHT = (Number(quoteDraft.durationDays) || 0) * (Number(quoteDraft.unitPrice) || 0)
  const totalTVA = totalHT * ((Number(quoteDraft.vatRate) || 0) / 100)
  const totalTTC = totalHT + totalTVA
  return { totalHT, totalTVA, totalTTC }
}

function buildQuoteNumberFromPeriodStart(periodStart) {
  if (!periodStart) {
    return 'D-2026-04'
  }

  const [year, month] = periodStart.split('-')
  if (!year || !month) {
    return 'D-2026-04'
  }

  return `D-${month}-${year}`
}

function createDraftFromSettings(settings) {
  const durationDays = Number(settings.missionQuotaDays) || 120
  const unitPrice = Number(settings.tjmHt) || 425
  const periodStart = settings.missionStartDate || '2026-04-01'

  return {
    number: buildQuoteNumberFromPeriodStart(periodStart),
    issueDate: '2026-03-31',
    subject: 'Prestations pour la DGFiP',
    providerName: settings.companyName || 'JACKY BAILLY - CALLIXTE',
    providerAddress: settings.companyAddress || '8 rue Labert Camus - 94230 Cachan',
    providerSiret: settings.companySiret || '98810510200012',
    providerContact:
      [settings.companyEmail, settings.companyPhone].filter(Boolean).join(' - ') ||
      'jacky.bailly.ent@gmail.com - 06 16 29 29 80',
    clientName: settings.clientName || 'APL DATA CENTER',
    clientAddress: settings.clientAddress || '106 Avenue Max Dormoy - 92120 Montrouge',
    clientContact:
      [settings.clientEmail, settings.clientPhone].filter(Boolean).join(' - ') ||
      'compta@apl-datacenter.fr - 01 46 94 91 00',
    periodStart,
    durationDays,
    unitPrice,
    paymentTermDays: Number(settings.paymentTermDays) || 60,
    vatRate: 20,
    description: 'Prestation freelance - Mission DGFiP',
  }
}

function buildQuotePayload(draft) {
  return {
    ...draft,
    items: [
      {
        description: draft.description,
        qty: Number(draft.durationDays) || 0,
        unitPrice: Number(draft.unitPrice) || 0,
      },
    ],
  }
}

export default function QuotesPage() {
  const [settings, setSettings] = React.useState(() => loadSettingsLike(SETTINGS_KEY))
  const [draft, setDraft] = React.useState(() => createDraftFromSettings(loadSettingsLike(SETTINGS_KEY)))
  const [history, setHistory] = React.useState(() => loadQuotesHistory())

  React.useEffect(() => {
    const refreshSettings = () => {
      setSettings(loadSettingsLike(SETTINGS_KEY))
    }

    window.addEventListener('settingsUpdated', refreshSettings)
    return () => window.removeEventListener('settingsUpdated', refreshSettings)
  }, [])

  const resetFromSettings = () => {
    const nextSettings = loadSettingsLike(SETTINGS_KEY)
    setSettings(nextSettings)
    setDraft(createDraftFromSettings(nextSettings))
  }

  const update = (key, value) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, [key]: value }

      if (key === 'periodStart') {
        nextDraft.number = buildQuoteNumberFromPeriodStart(value)
      }

      return nextDraft
    })
  }

  const quote = React.useMemo(() => buildQuotePayload(draft), [draft])
  const { totalHT, totalTVA, totalTTC } = React.useMemo(() => computeQuoteTotalsFromDraft(draft), [draft])

  const handleDownloadQuote = () => {
    downloadQuotePdf(quote, settings)

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      quote,
      settings: {
        logoDataUrl: settings.logoDataUrl || '',
        signatureDataUrl: settings.signatureDataUrl || '',
      },
    }

    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 50)
      saveQuotesHistory(next)
      return next
    })
  }

  const redownloadFromHistory = (entry) => {
    downloadQuotePdf(entry.quote, entry.settings || {})
  }

  const deleteHistoryEntry = (entryId) => {
    const confirmed = window.confirm('Supprimer ce devis de l\'historique ?')
    if (!confirmed) return

    setHistory((prev) => {
      const next = prev.filter((entry) => entry.id !== entryId)
      saveQuotesHistory(next)
      return next
    })
  }

  return (
    <div className="section">
      <div className="kpiRow">
        <div className="kpi">
          <div className="label">Devis actif</div>
          <div className="kpiVal statusInfo">1</div>
        </div>
        <div className="kpi">
          <div className="label">Montant HT</div>
          <div className="kpiVal statusWarn">{fmtEUR(totalHT)}</div>
        </div>
        <div className="kpi">
          <div className="label">Montant TTC</div>
          <div className="kpiVal statusGood">{fmtEUR(totalTTC)}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panelHeader">
          <div>
            <div className="panelTitle">Devis</div>
            <div className="panelDesc">Prérempli depuis Paramètres, modifiable manuellement avant export PDF</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={resetFromSettings}>
              <RefreshCw size={16} style={{ marginRight: 6 }} />
              Recharger depuis Paramètres
            </button>
            <button className="btnPrimary" type="button" onClick={handleDownloadQuote}>
              <Download size={16} style={{ marginRight: 6 }} />
              Télécharger le PDF
            </button>
          </div>
        </div>

        <div className="panelBody">
          <div className="settingsGrid">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Informations générales</div>
                  <div className="panelDesc">Ces champs pilotent l'en-tête du PDF</div>
                </div>
              </div>
              <div className="panelBody">
                <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <div className="label">Numéro du devis</div>
                    <input className="input" value={draft.number} onChange={(e) => update('number', e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Date du devis</div>
                    <input className="input" type="date" value={draft.issueDate} onChange={(e) => update('issueDate', e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <div className="label">Objet</div>
                  <input className="input" value={draft.subject} onChange={(e) => update('subject', e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Description de la prestation</div>
                  <input className="input" value={draft.description} onChange={(e) => update('description', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Mission</div>
                  <div className="panelDesc">Date de début, nombre de jours et TJM</div>
                </div>
              </div>
              <div className="panelBody">
                <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <div className="label">Date de début</div>
                    <input className="input" type="date" value={draft.periodStart} onChange={(e) => update('periodStart', e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Nombre de jours</div>
                    <input className="input" type="number" min="0" step="1" value={draft.durationDays} onChange={(e) => update('durationDays', Number(e.target.value))} />
                  </div>
                </div>
                <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <div className="label">TJM HT</div>
                    <input className="input" type="number" min="0" step="10" value={draft.unitPrice} onChange={(e) => update('unitPrice', Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <div className="label">TVA (%)</div>
                    <input className="input" type="number" min="0" step="1" value={draft.vatRate} onChange={(e) => update('vatRate', Number(e.target.value))} />
                  </div>
                </div>
                <div className="field">
                  <div className="label">Délai de paiement (jours)</div>
                  <input className="input" type="number" min="0" step="1" value={draft.paymentTermDays} onChange={(e) => update('paymentTermDays', Number(e.target.value))} />
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Prestataire</div>
                  <div className="panelDesc">Prérempli depuis les informations Entreprise</div>
                </div>
              </div>
              <div className="panelBody">
                <div className="field">
                  <div className="label">Nom</div>
                  <input className="input" value={draft.providerName} onChange={(e) => update('providerName', e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Adresse</div>
                  <input className="input" value={draft.providerAddress} onChange={(e) => update('providerAddress', e.target.value)} />
                </div>
                <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <div className="label">SIRET</div>
                    <input className="input" value={draft.providerSiret} onChange={(e) => update('providerSiret', e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Contact</div>
                    <input className="input" value={draft.providerContact} onChange={(e) => update('providerContact', e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Client</div>
                  <div className="panelDesc">Prérempli depuis les informations Mission / Client</div>
                </div>
              </div>
              <div className="panelBody">
                <div className="field">
                  <div className="label">Nom</div>
                  <input className="input" value={draft.clientName} onChange={(e) => update('clientName', e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Adresse</div>
                  <input className="input" value={draft.clientAddress} onChange={(e) => update('clientAddress', e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Contact</div>
                  <input className="input" value={draft.clientContact} onChange={(e) => update('clientContact', e.target.value)} />
                </div>
              </div>
            </section>
          </div>

          <div className="settingsGrid" style={{ marginTop: 16, gridTemplateColumns: '1fr 1fr' }}>
            <div className="previewBox">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Logo utilisé dans le PDF</div>
              {settings.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo paramétré" style={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain', display: 'block' }} />
              ) : (
                <div className="hint">Aucun logo défini dans Paramètres.</div>
              )}
            </div>
            <div className="previewBox">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Signature utilisée dans le PDF</div>
              {settings.signatureDataUrl ? (
                <img src={settings.signatureDataUrl} alt="Signature paramétrée" style={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain', display: 'block' }} />
              ) : (
                <div className="hint">Aucune signature définie dans Paramètres.</div>
              )}
            </div>
          </div>

          <div className="tableWrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date de début</th>
                  <th>Quantité</th>
                  <th>Prix unitaire HT</th>
                  <th>Total HT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{draft.description}</td>
                  <td>{draft.periodStart}</td>
                  <td>{draft.durationDays} jours</td>
                  <td>{fmtEUR(draft.unitPrice)} / jour</td>
                  <td style={{ fontWeight: 800 }}>{fmtEUR(totalHT)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="settingsGrid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="previewBox">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <FileText size={16} />
                Résumé HT
              </div>
              <div className="hint" style={{ marginTop: 8 }}>{fmtEUR(totalHT)}</div>
            </div>
            <div className="previewBox">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <FileText size={16} />
                TVA
              </div>
              <div className="hint" style={{ marginTop: 8 }}>{fmtEUR(totalTVA)} ({draft.vatRate} %)</div>
            </div>
            <div className="previewBox">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <FileText size={16} />
                Total TTC
              </div>
              <div className="hint" style={{ marginTop: 8 }}>{fmtEUR(totalTTC)}</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Historique des devis</div>
                <div className="panelDesc">Retéléchargement des PDF déjà générés</div>
              </div>
            </div>
            <div className="panelBody">
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>N° devis</th>
                      <th>Date devis</th>
                      <th>Début mission</th>
                      <th>Montant TTC</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">Aucun devis téléchargé pour le moment.</td>
                      </tr>
                    ) : (
                      history.map((entry) => {
                        const totals = computeQuoteTotalsFromDraft(entry.quote || {})
                        return (
                          <tr key={entry.id}>
                            <td style={{ fontWeight: 700 }}>{entry.quote?.number || '—'}</td>
                            <td className="muted">{entry.quote?.issueDate || '—'}</td>
                            <td className="muted">{entry.quote?.periodStart || '—'}</td>
                            <td style={{ fontWeight: 700 }}>{fmtEUR(totals.totalTTC)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 8 }}>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => redownloadFromHistory(entry)}
                                  title="Retélécharger le PDF"
                                >
                                  <Download size={16} />
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => deleteHistoryEntry(entry.id)}
                                  title="Supprimer de l'historique"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}