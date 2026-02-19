import React from 'react'

export default function Dashboard() {
  return (
    <div className="card">
      <div className="cardHeader">Bienvenue</div>
      <div className="cardBody">
        <p className="muted">
          Bienvenue dans FACT — Votre logiciel de facturation & suivi freelance.
        </p>
        <p className="muted small">
          Créez des devis, gérez vos factures, suivez vos jours ouvrés et pilotez votre activité avec des données stockées localement.
        </p>
      </div>
    </div>
  )
}
