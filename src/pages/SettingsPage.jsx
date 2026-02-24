import React from 'react'
import { invoiceHT, invoiceTTC, invoiceTVA, loadInvoices } from '../lib/invoices'
import { loadExpenses } from '../lib/expenses'

const STORAGE_KEY = 'fact_settings_v3'
const FULL_BACKUP_KEYS = [
  'fact_settings_v3',
  'nodebox_invoices',
  'nodebox_expenses',
  'nodebox_treasury',
  'nodebox_leaves',
  'fact_leaves_v2',
  'fact_tax_rs_v1',
  'fact_urssaf_v1',
  'nodebox_theme_v1',
  'nodebox_premium_v1',
]

const DEFAULTS = {
  // Entreprise
  companyName: '',
  companyPhone: '',
  companyAddress: '',
  companySiret: '',
  companyVatIntra: '',
  companyEmail: '',

  // Mission / Client
  clientName: '',
  clientAddress: '',
  clientPhone: '',
  clientEmail: '',
  purchaseOrder: '',
  missionStartDate: '',
  missionQuotaDays: 0,
  tjmHt: 0,

  // Banque
  bankName: '',
  iban: '',
  bic: '',

  // Documents
  logoDataUrl: null,
  signatureDataUrl: null,
  signerName: '',

  // Facturation
  paymentTermDays: 60, // Délai de paiement en jours (par défaut 60 jours)
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
  window.dispatchEvent(new CustomEvent('settingsUpdated'))
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function downloadFile(filename, mimeType, content, isBinary = false) {
  let blob
  if (isBinary && typeof content === 'string' && content.startsWith('<?xml')) {
    blob = new Blob([content], { type: 'application/vnd.ms-excel' })
  } else {
    blob = new Blob([content], { type: mimeType })
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value) {
  const raw = String(value ?? '')
  if (/[";\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function isoTodayCompact() {
  return new Date().toISOString().slice(0, 10)
}

export default function SettingsPage() {
  const [data, setData] = React.useState(() => loadSettings())
  const [savedMsg, setSavedMsg] = React.useState('')

  const importInputRef = React.useRef(null)
  const restoreFullInputRef = React.useRef(null)

  const showMsg = (msg) => {
    setSavedMsg(msg)
    window.setTimeout(() => setSavedMsg(''), 1800)
  }

  const update = (key, value) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const onSave = () => {
    saveSettings(data)
    showMsg('Enregistre')
  }

  const onReset = () => {
    setData(DEFAULTS)
    saveSettings(DEFAULTS)
    showMsg('Reinitialise')
  }

  const exportToFile = () => {
    const payload = {
      app: 'FACT',
      type: 'settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    }

    downloadFile('fact-settings.json', 'application/json', JSON.stringify(payload, null, 2))
    showMsg('Exporte')
  }

  const exportFullBackup = () => {
    const payload = {
      app: 'FACT',
      type: 'full-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      keys: FULL_BACKUP_KEYS,
      raw: FULL_BACKUP_KEYS.reduce((acc, key) => {
        acc[key] = localStorage.getItem(key)
        return acc
      }, {}),
    }

    downloadFile(
      `fact-backup-complet-${isoTodayCompact()}.json`,
      'application/json',
      JSON.stringify(payload, null, 2)
    )
    showMsg('Backup complet exporte')
  }

  const openRestoreFullDialog = () => {
    restoreFullInputRef.current?.click()
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
      showMsg('Importe')
    } catch (e) {
      console.error(e)
      showMsg('Fichier invalide')
    }
  }

  const restoreFullBackupFromFile = async (file) => {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const raw = parsed?.raw

      if (parsed?.type !== 'full-backup' || !raw || typeof raw !== 'object') {
        showMsg('Backup invalide')
        return
      }

      for (const key of FULL_BACKUP_KEYS) {
        const value = raw[key]
        if (value === null || value === undefined) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, String(value))
        }
      }

      const refreshed = loadSettings()
      setData(refreshed)
      showMsg('Backup restaure')
      window.setTimeout(() => window.location.reload(), 300)
    } catch (e) {
      console.error(e)
      showMsg('Backup invalide')
    }
  }

  const exportAccountingExcel = () => {
    const invoices = loadInvoices()
    const expenses = loadExpenses()
    const defaultTjm = Number(data.tjmHt ?? 0) || 0
    const now = new Date()
    const currentYear = now.getFullYear()

    // Récupérer toutes les années disponibles
    const yearsSet = new Set()
    for (const inv of invoices) {
      const year = Number(String(inv.issueDate || '').slice(0, 4))
      if (Number.isFinite(year)) yearsSet.add(year)
    }
    for (const exp of expenses) {
      const year = Number(String(exp.date || '').slice(0, 4))
      if (Number.isFinite(year)) yearsSet.add(year)
    }

    const years = Array.from(yearsSet).sort((a, b) => b - a)
    if (years.length === 0) years.push(currentYear)

    // Alerte si beaucoup de données (> 1000 lignes)
    const totalLines = invoices.length + expenses.length
    if (totalLines > 1000) {
      if (!window.confirm(`⚠️ Export volumineux (${totalLines} lignes). Cela peut être lent. Continuer ?`)) {
        return
      }
    }

    // Créer un classeur XML
    let xlsxContent = createExcelWorkbook(invoices, expenses, defaultTjm, years, currentYear)
    
    downloadFile(
      `fact-export-comptable-${isoTodayCompact()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsxContent,
      true
    )
    showMsg('Export Excel professionnel généré')
  }

  const createExcelWorkbook = (invoices, expenses, defaultTjm, years, currentYear) => {
    // Structure de base d'un XLSX (ZIP avec XML)
    // Pour la simplicité, on crée du CSV multi-onglets avec des tableaux professionnels
    
    let allSheets = {
      'Résumé': createSummarySheet(invoices, expenses, defaultTjm, years),
    }

    for (const year of years) {
      allSheets[`Factures ${year}`] = createInvoiceSheet(invoices, defaultTjm, year)
      allSheets[`Dépenses ${year}`] = createExpenseSheet(expenses, year)
    }

    // Créer un fichier CSV multi-onglets (format simplifié)
    // Ou créer du HTML pour Excel
    return createExcelFromSheets(allSheets)
  }

  const createSummarySheet = (invoices, expenses, defaultTjm, years) => {
    const rows = [
      ['RÉSUMÉ COMPTABLE', '', '', '', ''],
      ['', '', '', '', ''],
      ['Année', 'CA HT', 'TVA', 'CA TTC', 'Dépenses TTC'],
      []
    ]

    for (const year of years) {
      const yearInvoices = invoices.filter(inv => {
        const y = Number(String(inv.paymentDate || inv.issueDate || '').slice(0, 4))
        return y === year && inv.status === 'paid'
      })
      const yearExpenses = expenses.filter(exp => {
        const y = Number(String(exp.date || '').slice(0, 4))
        return y === year
      })

      const ht = yearInvoices.reduce((sum, inv) => sum + invoiceHT(inv, defaultTjm), 0)
      const tva = yearInvoices.reduce((sum, inv) => sum + invoiceTVA(inv, defaultTjm), 0)
      const ttc = yearInvoices.reduce((sum, inv) => sum + invoiceTTC(inv, defaultTjm), 0)
      const expTotal = yearExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

      rows.push([
        String(year),
        ht.toFixed(2),
        tva.toFixed(2),
        ttc.toFixed(2),
        expTotal.toFixed(2)
      ])
    }

    return rows
  }

  const createInvoiceSheet = (invoices, defaultTjm, year) => {
    const rows = [
      ['FACTURES', '', '', '', '', '', '', ''],
      [`Année: ${year}`, '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['N° Facture', 'Date Émission', 'Date Paiement', 'Statut', 'Client', 'Montant HT', 'Montant TVA', 'Montant TTC']
    ]

    const yearInvoices = invoices.filter(inv => {
      const y = Number(String(inv.issueDate || '').slice(0, 4))
      return y === year
    })

    for (const inv of yearInvoices.sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)))) {
      const ht = invoiceHT(inv, defaultTjm)
      const tva = invoiceTVA(inv, defaultTjm)
      const ttc = invoiceTTC(inv, defaultTjm)

      rows.push([
        inv.number || '',
        inv.issueDate || '',
        inv.paymentDate || '',
        inv.status || '',
        inv.clientName || '',
        ht.toFixed(2),
        tva.toFixed(2),
        ttc.toFixed(2)
      ])
    }

    // Totaux
    rows.push(['', '', '', '', 'TOTAL:', 
      `=SUM(F5:F${rows.length})`,
      `=SUM(G5:G${rows.length})`,
      `=SUM(H5:H${rows.length})`
    ])

    return rows
  }

  const createExpenseSheet = (expenses, year) => {
    const rows = [
      ['DÉPENSES', '', '', '', '', '', ''],
      [`Année: ${year}`, '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Date', 'Catégorie', 'Fournisseur', 'Description', 'Montant HT', 'Montant TVA', 'Montant TTC']
    ]

    const yearExpenses = expenses.filter(exp => {
      const y = Number(String(exp.date || '').slice(0, 4))
      return y === year
    })

    for (const exp of yearExpenses.sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
      const ttc = Number(exp.amount) || 0
      const ht = ttc / 1.2
      const tva = ttc - ht

      rows.push([
        exp.date || '',
        exp.category || '',
        exp.vendor || '',
        exp.description || '',
        ht.toFixed(2),
        tva.toFixed(2),
        ttc.toFixed(2)
      ])
    }

    // Totaux
    rows.push(['', '', '', 'TOTAL:', 
      `=SUM(E5:E${rows.length})`,
      `=SUM(F5:F${rows.length})`,
      `=SUM(G5:G${rows.length})`
    ])

    return rows
  }

  const createExcelFromSheets = (sheets) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<?mso-application progid="Excel.Sheet"?>\n'
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'

    // Styles avec mise en forme professionnelle
    xml += '<Styles>\n'
    
    // Style 1: En-tête principal (fond bleu foncé, blanc, gras)
    xml += '<Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="12"/><Interior ss:Color="#1F4788" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>\n'
    
    // Style 2: Total (fond gris clair, gras)
    xml += '<Style ss:ID="total"><Font ss:Bold="1" ss:Size="11" ss:Color="#000000"/><Interior ss:Color="#D9E8F5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0.00"/></Style>\n'
    
    // Style 3: Cellule texte normale
    xml += '<Style ss:ID="text"><Font ss:Size="11"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/></Style>\n'
    
    // Style 4: Nombre/devise (alignement droite)
    xml += '<Style ss:ID="number"><Font ss:Size="11"/><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>\n'
    
    // Style 5: Libellé total
    xml += '<Style ss:ID="totalLabel"><Font ss:Bold="1" ss:Size="11" ss:Color="#000000"/><Interior ss:Color="#D9E8F5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>\n'
    
    xml += '</Styles>\n'

    // Worksheets
    for (const [sheetName, rows] of Object.entries(sheets)) {
      xml += `<Worksheet ss:Name="${escapeXml(sheetName)}">\n`
      xml += '<Table ss:DefaultRowHeight="22">\n'

      // Colonnes avec largeurs appropriées
      const columnWidths = {
        'Résumé': [120, 120, 120, 120, 120],
        'default': [100, 100, 100, 150, 100, 100, 100]
      }
      const widths = columnWidths[sheetName] || columnWidths['default']
      
      for (let i = 0; i < Math.max(widths.length, rows[0]?.length || 0); i++) {
        xml += `<Column ss:Width="${widths[i] || 100}"/>\n`
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const isHeader = i === 0
        const isTotalRow = String(row[Math.max(0, row.length - 3)]).includes('TOTAL')
        
        xml += '<Row>\n'
        
        for (let j = 0; j < row.length; j++) {
          const value = String(row[j] || '')
          const isNumber = !isNaN(parseFloat(value)) && j > 0 && !value.includes('SUM')
          const isFormula = value.includes('=SUM') || value.includes('=')
          
          let style = 'text'
          if (isHeader) {
            style = 'header'
          } else if (isTotalRow) {
            style = (j === row.length - 3 || j === 0) ? 'totalLabel' : 'total'
          } else if (isNumber) {
            style = 'number'
          }

          if (isFormula) {
            xml += `<Cell ss:StyleID="${style}"><Formula>${escapeXml(value)}</Formula></Cell>\n`
          } else if (isNumber) {
            xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${escapeXml(value)}</Data></Cell>\n`
          } else {
            xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>\n`
          }
        }
        
        xml += '</Row>\n'
      }

      xml += '</Table>\n'
      xml += '</Worksheet>\n'
    }

    xml += '</Workbook>'
    return xml
  }

  const escapeXml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const exportAccountingCsv = () => {
    const invoices = loadInvoices()
    const expenses = loadExpenses()
    const defaultTjm = Number(data.tjmHt ?? 0) || 0

    const rows = [
      [
        'type',
        'date',
        'reference',
        'statut',
        'tiers',
        'description',
        'montant_ht',
        'montant_tva',
        'montant_ttc',
      ],
    ]

    for (const inv of invoices) {
      const ht = invoiceHT(inv, defaultTjm)
      const tva = invoiceTVA(inv, defaultTjm)
      const ttc = invoiceTTC(inv, defaultTjm)
      const date = String(inv.paymentDate || inv.issueDate || '')

      rows.push([
        'facture',
        date,
        inv.number || '',
        inv.status || '',
        inv.clientName || '',
        'Facturation',
        ht.toFixed(2),
        tva.toFixed(2),
        ttc.toFixed(2),
      ])
    }

    for (const exp of expenses) {
      const amountTtc = Number(exp.amount) || 0
      const tva = amountTtc - amountTtc / 1.2
      const ht = amountTtc - tva

      rows.push([
        'depense',
        exp.date || '',
        exp.id || '',
        'validee',
        exp.vendor || '',
        `${exp.category || ''} ${exp.description || ''}`.trim(),
        ht.toFixed(2),
        tva.toFixed(2),
        amountTtc.toFixed(2),
      ])
    }

    const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\n')
    downloadFile(`fact-export-comptable-${isoTodayCompact()}.csv`, 'text/csv;charset=utf-8', csv)
    showMsg('Export comptable CSV')
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
          void importFromFile(f)
          e.currentTarget.value = ''
        }}
      />

      <input
        ref={restoreFullInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          void restoreFullBackupFromFile(f)
          e.currentTarget.value = ''
        }}
      />

      <div className="cardHeader">
        <div className="row">
          <div>
            <div style={{ fontWeight: 900 }}>Parametres</div>
            <div className="hint">
              Entreprise • Mission/Client • Banque • Logo & Signature
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {savedMsg ? <span className="toast">{savedMsg}</span> : null}

            <button className="btn" onClick={openImportDialog} type="button">
              Importer parametres
            </button>
            <button className="btn" onClick={exportToFile} type="button">
              Exporter parametres
            </button>
            <button className="btn" onClick={exportFullBackup} type="button">
              Backup complet
            </button>
            <button className="btn" onClick={openRestoreFullDialog} type="button">
              Restaurer complet
            </button>
            <button className="btn" onClick={onReset} type="button">
              Reinitialiser
            </button>
            <button className="btnPrimary" onClick={onSave} type="button">
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      <div className="cardBody">
        <div className="settingsGrid">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Entreprise</div>
                <div className="panelDesc">Identite affichee sur les factures</div>
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

              <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Telephone</div>
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

              <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  placeholder="Ex: Societe XYZ"
                />
              </div>

              <div className="field">
                <div className="label">Adresse client</div>
                <input
                  className="input"
                  value={data.clientAddress}
                  onChange={(e) => update('clientAddress', e.target.value)}
                  placeholder="Adresse complete"
                />
              </div>

              <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Telephone client</div>
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

              <div className="settingsGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Date debut mission</div>
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
                <div className="label">TJM HT (EUR)</div>
                <input
                  className="input"
                  type="number"
                  value={data.tjmHt}
                  onChange={(e) => update('tjmHt', Number(e.target.value))}
                  step="10"
                  min="0"
                />
              </div>

              <div className="field">
                <div className="label">Délai de paiement (jours)</div>
                <input
                  className="input"
                  type="number"
                  value={data.paymentTermDays}
                  onChange={(e) => update('paymentTermDays', Number(e.target.value))}
                  step="1"
                  min="0"
                  placeholder="60"
                />
                <div className="small muted" style={{ marginTop: 4 }}>
                  Nombre de jours pour le paiement des factures à partir de la date d'émission (ex: 60 jours)
                </div>
              </div>
            </div>
          </section>

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
                  <div className="previewBox">
                    <div className="previewRow">
                      <div style={{ fontWeight: 800 }}>Apercu logo</div>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => update('logoDataUrl', null)}
                      >
                        Supprimer
                      </button>
                    </div>
                    <img
                      src={data.logoDataUrl}
                      alt="Logo"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 140,
                        objectFit: 'contain',
                        display: 'block',
                      }}
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
                  <div className="previewBox">
                    <div className="previewRow">
                      <div style={{ fontWeight: 800 }}>Apercu signature</div>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => update('signatureDataUrl', null)}
                      >
                        Supprimer
                      </button>
                    </div>
                    <img
                      src={data.signatureDataUrl}
                      alt="Signature"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 140,
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="field">
                <div className="label">Nom du signataire</div>
                <input
                  className="input"
                  value={data.signerName}
                  onChange={(e) => update('signerName', e.target.value)}
                  placeholder="Ex: Jacky Bailly"
                />
              </div>

              <div className="hint">
                Les images sont stockees en local. On les utilisera pour generer les factures en PDF plus tard.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
