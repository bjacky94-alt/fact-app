import React from 'react'

const STORAGE_KEY = 'fact_settings_v3'

const DEFAULTS = {
  companyName: '',
  companyPhone: '',
  companyAddress: '',
  companySiret: '',
  companyVatIntra: '',
  companyEmail: '',

  clientName: '',
  clientAddress: '',
  clientPhone: '',
  clientEmail: '',
  purchaseOrder: '',
  missionStartDate: '',
  missionQuotaDays: 0,
  tjmHt: 0,

  bankName: '',
  iban: '',
  bic: '',

  logoDataUrl: null,
  signatureDataUrl: null,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const [data, setData] = React.useState(() => loadSettings())
  const [savedMsg, setSavedMsg] = React.useState('')
  const importInputRef = React.useRef(null)

  const showMsg = (msg) => {
    setSavedMsg(msg)
    window.setTimeout(() => setSavedMsg(''), 1800)
  }

  const update = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const onSave = () => {
    saveSettings(data)
    showMsg('Enregistré ✓')
  }

  const onReset = () => {
    setData(DEFAULTS)
    saveSettings(DEFAULTS)
    showMsg('Réinitialisé ✓')
  }

  const exportToFile = () => {
    const payload = {
      app: 'FACT',
      type: 'settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'fact-settings.json'
    a.click()

    URL.revokeObjectURL(url)
    showMsg('Exporté ✓')
  }

  const openImportDialog = () => {
    importInputRef.current?.click()
  }

  const importFromFile = async (file) => {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const incoming = parsed?.data ?? parsed
      const merged = { ...DEFAULTS, ...incoming }
      setData(merged)
      saveSettings(merged)
      showMsg('Importé ✓')
    } catch (e) {
      console.error(e)
      showMsg('Fichier invalide ✖')
    }
  }

  const onUploadLogo = async (file) => {
    if (!file) return
    const url = await fileToDataUrl(file)
    update('logoDataUrl', url)
  }

  const onUploadSignature = async (file) => {
    if (!file) return
    const url = await fileToDataUrl(file)
    update('signatureDataUrl', url)
  }

  return (
    <div className="card">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          importFromFile(f)
          e.currentTarget.value = ''
        }}
      />

      <div className="cardHeader">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Paramètres</div>
            <div className="hint">Entreprise • Mission/Client • Banque • Logo & Signature</div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {savedMsg ? <span style={{ fontSize: 12, padding: '6px 10px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 999 }}>{savedMsg}</span> : null}

            <button className="btn" onClick={openImportDialog} type="button">
              Importer
            </button>
            <button className="btn" onClick={exportToFile} type="button">
              Exporter
            </button>
            <button className="btn" onClick={onReset} type="button">
              Réinitialiser
            </button>
            <button className="btnPrimary" onClick={onSave} type="button">
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      <div className="cardBody">
        <div className="settingsGrid">
          {/* ENTREPRISE */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Entreprise</div>
                <div className="panelDesc">Identité affichée sur les factures</div>
              </div>
            </div>

            <div className="panelBody">
              <div className="field">
                <div className="label">Nom</div>
                <input
                  className="input"
                  value={data.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  placeholder="Ex: Jacky Bailly Consulting"
                />
              </div>

              <div className="field">
                <div className="label">Adresse</div>
                <input
                  className="input"
                  value={data.companyAddress}
                  onChange={(e) => update('companyAddress', e.target.value)}
                  placeholder="Ex: 10 rue ..., 75000 Paris"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Téléphone</div>
                  <input
                    className="input"
                    value={data.companyPhone}
                    onChange={(e) => update('companyPhone', e.target.value)}
                    placeholder="06 12 34 56 78"
                  />
                </div>

                <div className="field">
                  <div className="label">Email</div>
                  <input
                    className="input"
                    value={data.companyEmail}
                    onChange={(e) => update('companyEmail', e.target.value)}
                    placeholder="contact@exemple.fr"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">SIRET</div>
                  <input
                    className="input"
                    value={data.companySiret}
                    onChange={(e) => update('companySiret', e.target.value)}
                    placeholder="123 456 789 00012"
                  />
                </div>

                <div className="field">
                  <div className="label">TVA intracom</div>
                  <input
                    className="input"
                    value={data.companyVatIntra}
                    onChange={(e) => update('companyVatIntra', e.target.value)}
                    placeholder="FRxx..."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* MISSION / CLIENT */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Mission / Client</div>
                <div className="panelDesc">Infos client + conditions de mission</div>
              </div>
            </div>

            <div className="panelBody">
              <div className="field">
                <div className="label">Nom du client</div>
                <input
                  className="input"
                  value={data.clientName}
                  onChange={(e) => update('clientName', e.target.value)}
                  placeholder="Ex: Société XYZ"
                />
              </div>

              <div className="field">
                <div className="label">Adresse client</div>
                <input
                  className="input"
                  value={data.clientAddress}
                  onChange={(e) => update('clientAddress', e.target.value)}
                  placeholder="Adresse complète"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Téléphone client</div>
                  <input
                    className="input"
                    value={data.clientPhone}
                    onChange={(e) => update('clientPhone', e.target.value)}
                    placeholder="01 23 45 67 89"
                  />
                </div>

                <div className="field">
                  <div className="label">Email client</div>
                  <input
                    className="input"
                    value={data.clientEmail}
                    onChange={(e) => update('clientEmail', e.target.value)}
                    placeholder="facturation@client.fr"
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">Bon de commande</div>
                <input
                  className="input"
                  value={data.purchaseOrder}
                  onChange={(e) => update('purchaseOrder', e.target.value)}
                  placeholder="Ex: BC-2026-001"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Date début mission</div>
                  <input
                    className="input"
                    type="date"
                    value={data.missionStartDate}
                    onChange={(e) => update('missionStartDate', e.target.value)}
                  />
                </div>

                <div className="field">
                  <div className="label">Quota jours</div>
                  <input
                    className="input"
                    type="number"
                    value={data.missionQuotaDays}
                    onChange={(e) => update('missionQuotaDays', Number(e.target.value))}
                    step="1"
                    min="0"
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">TJM HT (€)</div>
                <input
                  className="input"
                  type="number"
                  value={data.tjmHt}
                  onChange={(e) => update('tjmHt', Number(e.target.value))}
                  step="10"
                  min="0"
                />
              </div>
            </div>
          </section>

          {/* BANQUE */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Banque</div>
                <div className="panelDesc">Affichable sur la facture (RIB)</div>
              </div>
            </div>

            <div className="panelBody">
              <div className="field">
                <div className="label">Nom de la banque</div>
                <input
                  className="input"
                  value={data.bankName}
                  onChange={(e) => update('bankName', e.target.value)}
                  placeholder="Ex: BNP Paribas"
                />
              </div>

              <div className="field">
                <div className="label">IBAN</div>
                <input
                  className="input"
                  value={data.iban}
                  onChange={(e) => update('iban', e.target.value)}
                  placeholder="FR76..."
                />
              </div>

              <div className="field">
                <div className="label">BIC</div>
                <input
                  className="input"
                  value={data.bic}
                  onChange={(e) => update('bic', e.target.value)}
                  placeholder="BNPAFRPP..."
                />
              </div>
            </div>
          </section>

          {/* LOGO / SIGNATURE */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Logo & Signature</div>
                <div className="panelDesc">Import d'images pour la facture PDF</div>
              </div>
            </div>

            <div className="panelBody">
              <div className="field">
                <div className="label">Logo (image)</div>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onUploadLogo(e.target.files?.[0] ?? null)}
                />

                {data.logoDataUrl ? (
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 12, background: 'var(--surface2)', marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 800 }}>Aperçu logo</div>
                      <button className="btn" type="button" onClick={() => update('logoDataUrl', null)}>
                        Supprimer
                      </button>
                    </div>
                    <img
                      src={data.logoDataUrl}
                      alt="Logo"
                      style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="field">
                <div className="label">Signature (image)</div>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onUploadSignature(e.target.files?.[0] ?? null)}
                />

                {data.signatureDataUrl ? (
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 12, background: 'var(--surface2)', marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 800 }}>Aperçu signature</div>
                      <button className="btn" type="button" onClick={() => update('signatureDataUrl', null)}>
                        Supprimer
                      </button>
                    </div>
                    <img
                      src={data.signatureDataUrl}
                      alt="Signature"
                      style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="hint">Les images sont stockées en local. On les utilisera pour générer les factures en PDF plus tard.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
