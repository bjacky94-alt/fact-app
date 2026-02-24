import React, { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { invoiceTTC, loadInvoices, loadSettingsLike } from '../lib/invoices'
import { loadExpenses } from '../lib/expenses'

const SETTINGS_KEY = 'fact_settings_v3'

export default function TreasuryPage() {
  const [treasury, setTreasury] = useState([])
  const [newEntry, setNewEntry] = useState({
    id: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Revenu',
    description: '',
    amount: 0,
  })

  useEffect(() => {
    const stored = localStorage.getItem('nodebox_treasury')
    if (stored) {
      setTreasury(JSON.parse(stored))
    }
  }, [])

  const settings = loadSettingsLike(SETTINGS_KEY)
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0

  const paidInvoiceEntries = React.useMemo(() => {
    return loadInvoices()
      .filter((inv) => inv.status === 'paid')
      .map((inv) => ({
        id: `invoice-paid-${inv.id}`,
        date: String(inv.paymentDate || inv.issueDate || '').trim(),
        type: 'Revenu',
        description: `Facture payée ${inv.number || ''}`.trim(),
        amount: invoiceTTC(inv, defaultTjm),
        source: 'invoice-paid',
      }))
      .filter((entry) => entry.date)
  }, [defaultTjm, treasury])

  const expenseEntries = React.useMemo(() => {
    return loadExpenses()
      .map((exp) => {
        const category = String(exp.category || '').trim()
        const detail = String(exp.description || '').trim()
        const label = [category, detail].filter(Boolean).join(' • ')

        return {
          id: `expense-${exp.id}`,
          date: String(exp.date || '').trim(),
          type: 'Dépense',
          description: label ? `Dépense TTC ${label}` : 'Dépense TTC',
          amount: Number(exp.amount) || 0,
          source: 'expense',
        }
      })
      .filter((entry) => entry.date && entry.amount > 0)
  }, [treasury])

  const allEntries = React.useMemo(() => {
    return [
      ...treasury.map((entry) => ({ ...entry, source: 'manual' })),
      ...paidInvoiceEntries,
      ...expenseEntries,
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [treasury, paidInvoiceEntries, expenseEntries])

  const handleAddEntry = () => {
    if (!newEntry.description || newEntry.amount <= 0) {
      alert('Veuillez remplir tous les champs')
      return
    }

    const entry = {
      ...newEntry,
      id: Date.now().toString(),
      amount: parseFloat(newEntry.amount),
    }

    const updated = [entry, ...treasury]
    setTreasury(updated)
    localStorage.setItem('nodebox_treasury', JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('treasuryUpdated'))
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      type: 'Revenu',
      description: '',
      amount: 0,
    })
  }

  const handleDeleteEntry = (id) => {
    const updated = treasury.filter((entry) => entry.id !== id)
    setTreasury(updated)
    localStorage.setItem('nodebox_treasury', JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('treasuryUpdated'))
  }

  const income = allEntries.filter((e) => e.type === 'Revenu').reduce((sum, e) => sum + e.amount, 0)
  const expenses = allEntries.filter((e) => e.type === 'Dépense').reduce((sum, e) => sum + e.amount, 0)
  const balance = income - expenses

  return (
    <div className="section">
      <div className="kpiRow">
        <div className="kpi">
          <div className="label">Revenus</div>
          <div className="kpiVal">{income.toFixed(2)}€</div>
        </div>
        <div className="kpi">
          <div className="label">Dépenses</div>
          <div className="kpiVal">{expenses.toFixed(2)}€</div>
        </div>
        <div className="kpi">
          <div className="label">Solde</div>
          <div className="kpiVal">{balance.toFixed(2)}€</div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Ajouter une transaction</div>
        <div className="cardBody section">
          <div className="grid2">
            <div className="field">
              <div className="label">Date</div>
              <input
                className="input"
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="field">
              <div className="label">Type</div>
              <select
                className="select"
                value={newEntry.type}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option>Revenu</option>
                <option>Dépense</option>
              </select>
            </div>
            <div className="field">
              <div className="label">Montant (€)</div>
              <input
                className="input"
                type="number"
                value={newEntry.amount}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, amount: e.target.value }))}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="field">
            <div className="label">Description</div>
            <input
              className="input"
              type="text"
              value={newEntry.description}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
            />
          </div>
          <button onClick={handleAddEntry} className="btnPrimary" type="button">
            <Plus size={18} />
            Ajouter une transaction
          </button>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Historique</div>
        <div className="cardBody">
          {allEntries.length === 0 ? (
            <div className="muted small">Aucune transaction enregistrée</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.date).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <span className="badge">{entry.type}</span>
                      </td>
                      <td>{entry.description}</td>
                      <td>
                        {entry.type === 'Revenu' ? '+' : '-'}{entry.amount.toFixed(2)}€
                      </td>
                      <td className="actions">
                        {entry.source === 'manual' ? (
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="btn"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="muted small">Auto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
