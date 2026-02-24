import React, { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { loadInvoices, saveInvoices, workedDaysBetween, loadSettingsLike, bcUsedDays, clampToRemaining } from '../lib/invoices'

const SETTINGS_KEY = 'fact_settings_v3'

export default function LeavesPage() {
  const [leaves, setLeaves] = useState([])

  // Recalculer les factures avec quantités auto
  const recalculateAutoQuantities = (updatedLeaves) => {
    try {
      const invoices = loadInvoices()

      // Recalculer les quantités auto de toutes les factures
      const updatedInvoices = invoices.map((inv) => {
        // Chercher les items avec autoQty: true
        const items = inv.items.map((item) => {
          if (!item.autoQty) return item

          // Recalculer simplement selon les jours ouvrés - congés
          const newQty = workedDaysBetween(inv.periodStart, inv.periodEnd, true)

          return { ...item, qty: newQty }
        })

        return { ...inv, items }
      })

      saveInvoices(updatedInvoices)
    } catch (err) {
      console.error('Erreur lors du recalcul des quantités auto:', err)
    }
  }
  const [newLeave, setNewLeave] = useState({
    id: '',
    start: '',
    end: '', // Si vide = même jour, sinon intervalle
    isHalf: false, // true = demi-journée, false = journée complète (seulement si start === end)
    type: 'Congés',
    reason: '',
  })

  useEffect(() => {
    // Charger depuis fact_leaves_v2 (clé uniforme)
    const stored = localStorage.getItem('fact_leaves_v2')
    if (stored) {
      setLeaves(JSON.parse(stored))
    }
  }, [])

  const handleAddLeave = () => {
    if (!newLeave.start) {
      alert('Veuillez remplir la date du congé')
      return
    }

    const leave = {
      ...newLeave,
      id: Date.now().toString(),
    }

    const updated = [leave, ...leaves]
    setLeaves(updated)
    localStorage.setItem('fact_leaves_v2', JSON.stringify(updated))
    
    // Recalculer les quantités auto des factures
    recalculateAutoQuantities(updated)
    
    setNewLeave({
      start: '',
      end: '',
      isHalf: false,
      type: 'Congés',
      reason: '',
    })
  }

  const handleDeleteLeave = (id) => {
    const updated = leaves.filter((leave) => leave.id !== id)
    setLeaves(updated)
    localStorage.setItem('fact_leaves_v2', JSON.stringify(updated)) // Clé uniforme
    
    // Recalculer les quantités auto des factures
    recalculateAutoQuantities(updated)
  }

  return (
    <div className="section">
      <div className="card">
        <div className="cardHeader">Ajouter un congé</div>
        <div className="cardBody section">
          <div className="grid2">
            <div className="field">
              <div className="label">Type</div>
              <select
                className="select"
                value={newLeave.type}
                onChange={(e) => setNewLeave((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option>Congés</option>
                <option>Maladie</option>
                <option>Absence justifiée</option>
                <option>RTT</option>
              </select>
            </div>
          </div>
          
          <div className="grid2">
            <div className="field">
              <div className="label">Du</div>
              <input
                className="input"
                type="date"
                value={newLeave.start}
                onChange={(e) => setNewLeave((prev) => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="field">
              <div className="label">Au (optionnel)</div>
              <input
                className="input"
                type="date"
                value={newLeave.end}
                onChange={(e) => setNewLeave((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          
          {/* Afficher le toggle demi-journée seulement si c'est une seule journée */}
          {!newLeave.end && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${newLeave.isHalf ? 'btnPrimary' : ''}`}
                onClick={() => setNewLeave((prev) => ({ ...prev, isHalf: !prev.isHalf }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: newLeave.isHalf ? 'var(--accent)' : 'var(--surface2)',
                  color: newLeave.isHalf ? '#fff' : 'inherit',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {newLeave.isHalf ? '✓ Demi-journée' : 'Demi-journée'}
              </button>
              <div className="small" style={{ marginTop: 6, color: 'var(--muted)' }}>
                {newLeave.isHalf ? '0.5 jour' : '1 jour complet'}
              </div>
            </div>
          )}
          {/* Afficher le toggle grisé si intervalle de dates */}
          {newLeave.end && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                disabled
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface3)',
                  color: 'var(--muted)',
                  cursor: 'not-allowed',
                  fontWeight: 500,
                  opacity: 0.5
                }}
              >
                Demi-journée (désactivé pour intervalle)
              </button>
              <div className="small" style={{ marginTop: 6, color: 'var(--muted)' }}>
                Jours complets uniquement
              </div>
            </div>
          )}

          <div className="field">
            <div className="label">Raison (optionnel)</div>
            <input
              className="input"
              type="text"
              value={newLeave.reason}
              onChange={(e) => setNewLeave((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Motif du congé"
            />
          </div>
          <button onClick={handleAddLeave} className="btnPrimary" type="button">
            <Plus size={18} />
            Ajouter
          </button>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Historique</div>
        <div className="cardBody">
          {leaves.length === 0 ? (
            <div className="muted small">Aucun congé enregistré</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Du</th>
                    <th>Au</th>
                    <th>Durée</th>
                    <th>Raison</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => {
                    const start = new Date(leave.start)
                    const end = leave.end ? new Date(leave.end) : start
                    
                    // Calculer la durée en jours
                    let duration = 1
                    if (leave.end) {
                      // Intervalle en jours
                      duration = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
                    } else if (leave.isHalf) {
                      duration = 0.5
                    }
                    
                    const durationText = `${duration} jour${duration > 1 ? 's' : ''}`
                    
                    return (
                      <tr key={leave.id}>
                        <td>
                          <span className="badge">{leave.type}</span>
                        </td>
                        <td>{start.toLocaleDateString('fr-FR')}</td>
                        <td>{end.toLocaleDateString('fr-FR')}</td>
                        <td>{durationText} {leave.isHalf && !leave.end ? '(demi-journée)' : ''}</td>
                        <td>{leave.reason || '—'}</td>
                        <td className="actions">
                          <button
                            onClick={() => handleDeleteLeave(leave.id)}
                            className="btn"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
