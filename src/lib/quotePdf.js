import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtEUR } from './invoices'

const safe = (value) => String(value ?? '').trim()
const pdfSafe = (text) =>
  String(text || '')
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')

const isISO = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))

const parseISOToFR = (iso) => {
  if (!isISO(iso)) return safe(iso)
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

const safeFilename = (quoteNumber) => {
  const cleaned = String(quoteNumber || 'devis')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/--+/g, '-')
    .trim()
  return cleaned || 'devis'
}

const line = (doc, x1, y1, x2, y2, gray = 214, width = 0.8) => {
  doc.setDrawColor(gray)
  doc.setLineWidth(width)
  doc.line(x1, y1, x2, y2)
}

const roundedBox = (doc, x, y, w, h, radius = 10, gray = 220, dashed = false) => {
  doc.setDrawColor(gray)
  doc.setLineWidth(1)
  if (dashed && doc.setLineDashPattern) {
    doc.setLineDashPattern([3, 2], 0)
  }
  doc.roundedRect(x, y, w, h, radius, radius)
  if (dashed && doc.setLineDashPattern) {
    doc.setLineDashPattern([], 0)
  }
}

const drawTextBlock = (doc, text, x, y, maxWidth, lineHeight = 11) => {
  const value = pdfSafe(safe(text))
  if (!value) return y
  const lines = doc.splitTextToSize(value, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

const computeTotals = (quote) => {
  const items = Array.isArray(quote.items) ? quote.items : []
  const totalHT = items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return sum + qty * unitPrice
  }, 0)
  const vatRate = Number(quote.vatRate) || 0
  const totalTVA = totalHT * vatRate / 100
  const totalTTC = totalHT + totalTVA
  return { totalHT, totalTVA, totalTTC }
}

const resolveItems = (quote) => {
  if (Array.isArray(quote.items) && quote.items.length > 0) return quote.items
  return [
    {
      description: quote.description || '',
      qty: Number(quote.durationDays) || 0,
      unitPrice: Number(quote.unitPrice) || 0,
    },
  ]
}

export function downloadQuotePdf(quote, settings = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 24
  const contentW = pageW - margin * 2
  const items = resolveItems(quote)
  const totals = computeTotals({ ...quote, items })

  const provider = {
    name: safe(quote.providerName || settings.companyName || ''),
    address: safe(quote.providerAddress || settings.companyAddress || ''),
    siret: safe(quote.providerSiret || settings.companySiret || ''),
    contact: safe(
      quote.providerContact || [settings.companyEmail, settings.companyPhone].filter(Boolean).join(' - ')
    ),
  }

  const client = {
    name: safe(quote.clientName || settings.clientName || ''),
    address: safe(quote.clientAddress || settings.clientAddress || ''),
    contact: safe(
      quote.clientContact || [settings.clientEmail, settings.clientPhone].filter(Boolean).join(' - ')
    ),
  }

  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, 'PNG', margin, 30, 36, 36)
    } catch {}
  } else {
    doc.setDrawColor(11, 125, 176)
    doc.setFillColor(11, 125, 176)
    doc.roundedRect(margin, 26, 34, 34, 7, 7, 'FD')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('C', margin + 17, 49, { align: 'center' })
  }

  doc.setTextColor(11, 32, 68)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('DEVIS', margin + 48, 44)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(pdfSafe((provider.name.split(' - ').slice(-1)[0] || provider.name || 'PRESTATAIRE').slice(0, 20)), margin + 18, 77, {
    align: 'center',
    maxWidth: 44,
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Date : ${pdfSafe(parseISOToFR(quote.issueDate || ''))}`, pageW - margin, 34, { align: 'right' })
  doc.text(`N° devis : ${pdfSafe(safe(quote.number || ''))}`, pageW - margin, 50, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Objet :', margin + 48, 60)
  doc.setFont('helvetica', 'normal')
  doc.text(pdfSafe(safe(quote.subject || '')), margin + 86, 60)

  line(doc, margin - 14, 88, pageW - margin + 14, 88)

  const topBoxesY = 104
  const boxGap = 12
  const boxW = (contentW - boxGap) / 2

  roundedBox(doc, margin, topBoxesY, boxW, 102)
  roundedBox(doc, margin + boxW + boxGap, topBoxesY, boxW, 102)

  doc.setTextColor(11, 32, 68)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PRESTATAIRE', margin + 10, topBoxesY + 20)
  doc.text('CLIENT', margin + boxW + boxGap + 10, topBoxesY + 20)

  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  drawTextBlock(doc, [provider.name, provider.address, provider.siret ? `SIRET : ${provider.siret}` : '', provider.contact].filter(Boolean).join('\n'), margin + 10, topBoxesY + 42, boxW - 20, 15)
  drawTextBlock(doc, [client.name, client.address, client.contact].filter(Boolean).join('\n'), margin + boxW + boxGap + 10, topBoxesY + 42, boxW - 20, 15)

  const periodY = topBoxesY + 126
  roundedBox(doc, margin, periodY, contentW, 54)
  doc.setTextColor(11, 32, 68)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text("PÉRIODE D'EXÉCUTION", margin + 10, periodY + 18)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal')
  doc.text(
    pdfSafe(`Date de début : ${parseISOToFR(quote.periodStart || '')} — Nombre de jours : ${Number(quote.durationDays) || 0} jours`),
    margin + 10,
    periodY + 40
  )

  autoTable(doc, {
    startY: periodY + 78,
    head: [['Description', 'Quantité', 'Prix unitaire HT', 'Total HT']],
    body: items.map((item) => {
      const qty = Number(item.qty) || 0
      const unitPrice = Number(item.unitPrice) || 0
      return [
        pdfSafe(item.description || ''),
        pdfSafe(`${qty} jours`),
        pdfSafe(`${fmtEUR(unitPrice)} / jour`),
        pdfSafe(fmtEUR(qty * unitPrice)),
      ]
    }),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 8,
      textColor: 20,
      lineColor: [211, 220, 232],
      lineWidth: 1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [11, 32, 68],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 264 },
      1: { halign: 'left', cellWidth: 88 },
      2: { halign: 'left', cellWidth: 100 },
      3: { halign: 'right', cellWidth: 100 },
    },
  })

  let y = doc.lastAutoTable.finalY + 10
  const summaryX = margin + 342
  const summaryLabelW = 126
  const summaryValW = 100
  const rowH = 30

  ;[
    ['Total HT', fmtEUR(totals.totalHT)],
    ['TVA', `${fmtEUR(totals.totalTVA)} (${Number(quote.vatRate) || 0} %)`],
    ['Total TTC', fmtEUR(totals.totalTTC), true],
  ].forEach(([label, value, bold]) => {
    doc.setDrawColor(211, 220, 232)
    doc.rect(summaryX, y, summaryLabelW, rowH)
    doc.rect(summaryX + summaryLabelW, y, summaryValW, rowH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(11, 32, 68)
    doc.text(pdfSafe(label), summaryX + summaryLabelW - 10, y + 20, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    doc.text(pdfSafe(value), summaryX + summaryLabelW + summaryValW - 10, y + 20, { align: 'right' })
    y += rowH
  })

  const footerY = Math.max(y + 24, pageH - 142)
  const footerBoxW = (contentW - boxGap) / 2
  roundedBox(doc, margin, footerY, footerBoxW, 130)
  roundedBox(doc, margin + footerBoxW + boxGap, footerY, footerBoxW, 130, 10, 220, true)

  doc.setTextColor(11, 32, 68)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('MODALITÉS DE PAIEMENT', margin + 10, footerY + 20)
  doc.text('SIGNATURE', margin + footerBoxW + boxGap + 10, footerY + 20)

  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const paymentTerms = [
    '• Paiement par virement bancaire',
    `• Délai de règlement : ${Number(quote.paymentTermDays) || 60} jours à compter de la date d'émission`,
  ].join('\n')
  drawTextBlock(doc, paymentTerms, margin + 10, footerY + 42, footerBoxW - 20, 16)

  doc.text('Bon pour accord,', margin + footerBoxW + boxGap + 10, footerY + 42)
  doc.text('Signature du prestataire :', margin + footerBoxW + boxGap + 10, footerY + 66)
  roundedBox(doc, margin + footerBoxW + boxGap + 12, footerY + 74, footerBoxW - 24, 44, 8, 224)

  if (settings.signatureDataUrl) {
    try {
      doc.addImage(settings.signatureDataUrl, 'PNG', margin + footerBoxW + boxGap + 86, footerY + 80, 96, 28)
    } catch {}
  }

  doc.save(`${safeFilename(quote.number)}.pdf`)
}
