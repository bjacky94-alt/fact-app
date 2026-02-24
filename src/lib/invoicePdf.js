import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  bcUsedDays,
  invoiceHT,
  invoiceTVA,
  invoiceTTC,
  fmtEUR,
} from "./invoices";

/* ================= Helpers ================= */
const s = (v) => String(v ?? "").trim();

const pdfSafe = (text) =>
  String(text || "")
    .replace(/\u202f/g, " ")
    .replace(/\u00a0/g, " ");

/**
 * Crée un nom de fichier sécurisé à partir du numéro de facture
 * Remplace les caractères invalides pour les noms de fichiers
 */
const safeFilename = (invoiceNumber) => {
  const cleaned = String(invoiceNumber || "facture")
    .replace(/[<>:"/\\|?*]/g, "-") // Caractères invalides → tiret
    .replace(/\s+/g, "_") // Espaces → underscore
    .replace(/--+/g, "-") // Multiple tirets → tiret unique
    .trim();
  return cleaned || "facture";
};

const isISO = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
const parseISOToFR = (iso) => {
  if (!isISO(iso)) return s(iso);
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const toUTCDate = (iso) => {
  const [y, m, d] = (iso || "").split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

const diffDays = (aISO, bISO) => {
  if (!isISO(aISO) || !isISO(bISO)) return null;
  const a = toUTCDate(aISO).getTime();
  const b = toUTCDate(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

const frNumber = (n) =>
  pdfSafe(
    (Number(n) || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
  );

const safeMoney = (n) => pdfSafe(fmtEUR(n));

const setGray = (doc, g) => doc.setTextColor(g, g, g);

const drawLine = (
  doc,
  x1,
  y1,
  x2,
  y2,
  w = 0.8,
  gray = 220
) => {
  doc.setDrawColor(gray);
  doc.setLineWidth(w);
  doc.line(x1, y1, x2, y2);
};

const drawBox = (
  doc,
  x,
  y,
  w,
  h,
  r = 14,
  stroke = 220,
  fill
) => {
  doc.setDrawColor(stroke);
  doc.setLineWidth(1);
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, y, w, h, r, r, "FD");
  } else {
    doc.roundedRect(x, y, w, h, r, r);
  }
};

// Bloc multi-ligne propre + renvoie le Y bas
function drawTextBlock(
  doc,
  text,
  x,
  y,
  maxWidth,
  lineHeight = 12
) {
  const t = pdfSafe(s(text));
  if (!t) return y;
  const lines = doc.splitTextToSize(t, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/* ================= Layout ================= */
const L = {
  margin: 44,
  logoSize: 75,
  headerTop: 42,
  bandH: 74,
};

/* ================= Watermark ================= */
function drawWatermark(
  doc,
  settings,
  pageW,
  pageH,
  isPaid = false
) {
  if (isPaid) {
    // Watermark "PAYÉE" en grand, diagonal et transparent via canvas
    try {
      // Créer un canvas pour le texte roté
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      
      // Fond transparent
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Configuration du texte - 3x plus grand
      ctx.font = "bold 420px Arial";
      ctx.fillStyle = "rgba(220, 20, 60, 0.15)"; // Rouge transparent
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Appliquer la rotation de -45 degrés
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-45 * Math.PI) / 180);
      ctx.fillText("PAYÉE", 0, 0);
      ctx.restore();
      
      // Convertir en image et l'ajouter au PDF
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", pageW / 2 - 300, pageH / 2 - 150, 600, 300);
    } catch (err) {
      console.warn("Erreur watermark PAYÉE avec canvas:", err);
      // Fallback : texte sans rotation
      try {
        const anyDoc = doc;
        if (anyDoc.GState) {
          const gs = new anyDoc.GState({ opacity: 0.2 });
          anyDoc.setGState(gs);
        }
        doc.setTextColor(220, 20, 60);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(100);
        doc.text("PAYÉE", pageW / 2, pageH / 2, { align: "center" });
        if (anyDoc.GState) {
          const gs2 = new anyDoc.GState({ opacity: 1 });
          anyDoc.setGState(gs2);
        }
        doc.setTextColor(0, 0, 0);
      } catch (e) {
        console.error("Erreur fallback watermark:", e);
      }
    }
  } else if (settings.logoDataUrl) {
    try {
      const anyDoc = doc;
      if (anyDoc.GState) {
        const gs = new anyDoc.GState({ opacity: 0.08 });
        anyDoc.setGState(gs);
        doc.addImage(
          settings.logoDataUrl,
          "PNG",
          pageW / 2 - 240,
          pageH / 2 - 240,
          480,
          480
        );
        const gs2 = new anyDoc.GState({ opacity: 1 });
        anyDoc.setGState(gs2);
      } else {
        doc.addImage(
          settings.logoDataUrl,
          "PNG",
          pageW / 2 - 200,
          pageH / 2 - 200,
          400,
          400
        );
      }
    } catch {}
  }
}

/* ================= Header (Émetteur gauche + Client droite sur même ligne) ================= */
function drawHeaderLine(
  doc,
  inv,
  settings,
  pageW
) {
  const m = L.margin;
  const right = pageW - m;
  const top = L.headerTop;

  // Logo (haut gauche)
  if (settings.logoDataUrl) {
    try {
      doc.addImage(
        settings.logoDataUrl,
        "PNG",
        m,
        top,
        L.logoSize,
        L.logoSize
      );
    } catch {}
  }

  // Métas facture (haut droite)
  const metaRightX = right;
  let metaBottom = top;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setGray(doc, 120);
  doc.text("N° FACTURE", metaRightX, top + 10, { align: "right" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(pdfSafe(s(inv.number)), metaRightX, top + 26, { align: "right" });

  doc.setFontSize(14);
  doc.text("Facture", metaRightX, top + 46, { align: "right" });

  const subtitle = s(settings.subtitle || "");
  if (subtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setGray(doc, 110);
    const subLines = doc.splitTextToSize(pdfSafe(subtitle), 230);
    doc.text(subLines, metaRightX, top + 62, { align: "right" });
    metaBottom = top + 62 + subLines.length * 11;
    doc.setTextColor(0, 0, 0);
  } else {
    metaBottom = top + 46;
  }

  // Décalage vertical manuel du bloc EMETTEUR / CLIENT
  const verticalOffset = 12;

  const colsTop = Math.max(top + 60, top + L.logoSize + 12) + verticalOffset;

  // largeur d'une colonne
  const colW = 255;

  // espace entre les 2 blocs
  const colGap = 40;

  // largeur totale du bloc EMETTEUR + CLIENT
  const totalWidth = colW * 2 + colGap;

  // point de départ centré dans la page
  const startX = (pageW - totalWidth) / 2;

  // largeur totale utile du document (même que tableau)
  const contentWidth = pageW - L.margin * 2;

  // on aligne EMETTEUR / CLIENT sur cette même grille
  const issuerX = L.margin;
  const clientX = L.margin + contentWidth / 2 + 20; // espace entre les 2

  // ---- ÉMETTEUR ----
  let issuerBottom = colsTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setGray(doc, 120);
  doc.text("ÉMETTEUR", issuerX, colsTop);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(
    pdfSafe(s(settings.companyName || "ENTREPRISE")),
    issuerX,
    colsTop + 20,
    {
      maxWidth: colW,
    }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  setGray(doc, 60);

  const emitterLines = [
    s(settings.companyAddress),
    [s(settings.companyPhone), s(settings.companyEmail)]
      .filter(Boolean)
      .join(" · "),
    settings.companySiret ? `SIRET : ${s(settings.companySiret)}` : "",
    settings.companyVatIntra ? `TVA : ${s(settings.companyVatIntra)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  issuerBottom = drawTextBlock(
    doc,
    emitterLines || "—",
    issuerX,
    colsTop + 36,
    colW,
    12
  );

  // ---- CLIENT ----
  let clientBottom = colsTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setGray(doc, 120);
  doc.text("CLIENT", clientX, colsTop);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(pdfSafe(s(inv.clientName || "—")), clientX, colsTop + 20, {
    maxWidth: colW,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setGray(doc, 60);

  const clientLines = [
    s(inv.clientAddress),
    [s(inv.clientPhone), s(inv.clientEmail)].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n");

  clientBottom = drawTextBlock(
    doc,
    clientLines || "—",
    clientX,
    colsTop + 36,
    colW,
    12
  );

  if (inv.purchaseOrder) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    const poLines = doc.splitTextToSize(
      pdfSafe(`Numéro de commande : ${s(inv.purchaseOrder)}`),
      colW
    );
    doc.text(poLines, clientX, clientBottom + 8);
    clientBottom = clientBottom + 8 + poLines.length * 12;
  }

  // Séparateur sous header: dynamique (anti-chevauchement)
  const sepY = Math.max(issuerBottom, clientBottom, metaBottom) + 18;
  drawLine(doc, m, sepY, right, sepY, 1, 220);

  return sepY + 18;
}

/* ================= Metrics band ================= */
function computeProgress(inv, settings) {
  const quota = Number(settings.missionQuotaDays || 0) || 0;
  const po = s(inv.purchaseOrder);

  const allInvoices = (() => {
    try {
      const raw = localStorage.getItem("nodebox_invoices");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const usedAll = quota > 0 && po ? bcUsedDays(allInvoices, po) : 0;
  const thisQty = (inv.items || []).reduce(
    (sum, it) => sum + (Number(it.qty) || 0),
    0
  );

  const totalPct = quota > 0 ? (usedAll / quota) * 100 : 0;
  const monthPct = quota > 0 ? (thisQty / quota) * 100 : 0;

  return { quota, usedAll, thisQty, totalPct, monthPct };
}

function drawMetricsBand(
  doc,
  inv,
  settings,
  pageW,
  y
) {
  const m = L.margin;
  const w = pageW - m * 2;

  const prog = computeProgress(inv, settings);
  const delay = diffDays(inv.issueDate, inv.dueDate);
  const dueText =
    delay !== null && delay > 0
      ? `${delay} jours (${parseISOToFR(inv.dueDate)})`
      : parseISOToFR(inv.dueDate);

  drawBox(doc, m, y, w, L.bandH, 16, 220, [250, 251, 253]);

  const cols = [
    { title: "DATE DE FACTURE", val: parseISOToFR(inv.issueDate) },
    { title: "ÉCHÉANCE DE PAIEMENT", val: dueText },
    {
      title: "AVANCEMENT TOTAL",
      val:
        prog.quota > 0
          ? `${frNumber(prog.totalPct)}% (${frNumber(prog.usedAll)}/${
              prog.quota
            })`
          : "—",
    },
    {
      title: "AVANCEMENT MOIS",
      val:
        prog.quota > 0
          ? `${frNumber(prog.monthPct)}% (${frNumber(prog.thisQty)}/${
              prog.quota
            })`
          : "—",
    },
  ];

  const colW = w / cols.length;

  for (let i = 1; i < cols.length; i++) {
    drawLine(doc, m + colW * i, y + 12, m + colW * i, y + L.bandH - 12, 1, 235);
  }

  cols.forEach((c, i) => {
    const cx = m + colW * i + 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setGray(doc, 120);
    doc.text(pdfSafe(c.title), cx, y + 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(pdfSafe(c.val), cx, y + 46);
  });

  return y + L.bandH + 24;
}

/* ================= Main Table ================= */
function drawMainTable(
  doc,
  inv,
  settings,
  defaultTjm,
  startY
) {
  let y = startY;

  const ref = s(settings.refAffaire || "");
  if (ref) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setGray(doc, 60);
    doc.text(pdfSafe("DESCRIPTION : REF AFFAIRE / OPÉRATIONS :"), L.margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(pdfSafe(ref), L.margin + 250, y);
    y += 14;
  }

  const body = (inv.items || []).map((it) => {
    const qty = Number(it.qty) || 0;
    const pu =
      it.unitPrice === null || it.unitPrice === undefined || it.unitPrice === 0
        ? Number(defaultTjm) || 0
        : Number(it.unitPrice) || 0;

    const total = qty * pu;
    const tva = inv.vatEnabled ? Number(inv.vatRate || 0) : 0;

    return [
      pdfSafe(it.description || ""),
      pdfSafe(frNumber(qty)),
      pdfSafe(fmtEUR(pu)),
      pdfSafe(String(tva)),
      pdfSafe(fmtEUR(total)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["DESCRIPTION", "QTÉ", "PU HT", "TVA %", "TOTAL HT"]],
    body,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: 20 },
    headStyles: { fontStyle: "bold", textColor: 80 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 55 },
      2: { halign: "right", cellWidth: 85 },
      3: { halign: "right", cellWidth: 55 },
      4: { halign: "right", cellWidth: 95 },
    },
    didDrawCell: (data) => {
      const { doc: d, cell, section } = data;
      if (section === "head") {
        d.setDrawColor(80);
        d.setLineWidth(1);
        d.line(
          cell.x,
          cell.y + cell.height,
          cell.x + cell.width,
          cell.y + cell.height
        );
      }
      if (section === "body") {
        d.setDrawColor(210);
        d.setLineWidth(0.6);
        d.line(
          cell.x,
          cell.y + cell.height,
          cell.x + cell.width,
          cell.y + cell.height
        );
      }
    },
  });

  return doc.lastAutoTable.finalY + 18;
}

/* ================= Totals + Footer ================= */
function drawFooterSection(
  doc,
  inv,
  settings,
  defaultTjm,
  pageW,
  pageH,
  y
) {
  const m = L.margin;
  const rightX = pageW - m;

  const ht = invoiceHT(inv, defaultTjm);
  const tva = invoiceTVA(inv, defaultTjm);
  const ttc = invoiceTTC(inv, defaultTjm);

  // Totaux: 2 colonnes fixes (anti "Total TTC11 220,00 €")
  const valueX = rightX;
  const labelX = rightX - 220;

  const rowH = 26;
  let ty = y + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  doc.text("Sous-total HT", labelX, ty);
  doc.text(safeMoney(ht), valueX, ty, { align: "right" });
  drawLine(doc, labelX, ty + 6, valueX, ty + 6, 0.8, 160);

  ty += rowH;

  if (tva > 0) {
    doc.text("TVA", labelX, ty);
    doc.text(safeMoney(tva), valueX, ty, { align: "right" });
    drawLine(doc, labelX, ty + 6, valueX, ty + 6, 0.8, 160);
    ty += rowH;
  }

  doc.setFontSize(12);
  doc.text("Total TTC", labelX, ty + 6);
  doc.text(safeMoney(ttc), valueX, ty + 6, { align: "right" });

  // Footer area
  const footerH = 140;
  const footerY = Math.max(ty + 44, pageH - footerH - 30);

  // Boîte unifiée Banque + Signature
  drawBox(doc, m, footerY, pageW - m * 2, 100, 12, 235);

  // Banque gauche (dans la boîte)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setGray(doc, 90);
  doc.text("BANQUE", m + 10, footerY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(pdfSafe(s(settings.bankName || "")) || "—", m + 10, footerY + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setGray(doc, 80);
  if (settings.iban)
    doc.text(pdfSafe(`IBAN: ${settings.iban}`), m + 10, footerY + 42);
  if (settings.bic) doc.text(pdfSafe(`BIC: ${settings.bic}`), m + 10, footerY + 54);

  // Signature droite (dans la boîte)
  const sigX = pageW - 170;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setGray(doc, 90);
  doc.text("SIGNATURE", sigX, footerY + 12);

  if (settings.signatureDataUrl) {
    try {
      doc.addImage(
        settings.signatureDataUrl,
        "PNG",
        sigX,
        footerY + 20,
        60,
        30
      );
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(pdfSafe(s(settings.signerName || "")), sigX, footerY + 64);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setGray(doc, 110);
  const dateStr = parseISOToFR(inv.issueDate);
  const locStr = settings.placeOfIssue
    ? `Fait à ${settings.placeOfIssue} le ${dateStr}`
    : `Le ${dateStr}`;
  doc.text(pdfSafe(locStr), pageW / 2, footerY + 90, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setGray(doc, 90);
  const politeness =
    "Nous apprécions votre clientèle. Si vous avez des questions sur cette facture, n'hésitez pas à nous contacter.";
  doc.text(pdfSafe(politeness), pageW / 2, pageH - 20, { align: "center" });

  doc.setTextColor(0, 0, 0);
}

/* ================= Tampon PAYÉE ================= */
function drawPaidStamp(doc, pageW, pageH) {
  const stampW = 120;
  const stampH = 50;
  const stampX = pageW - stampW - 20;
  const stampY = pageH - stampH - 20;

  // Boîte avec bordure
  doc.setDrawColor(220, 20, 60); // Crimson red
  doc.setLineWidth(2);
  doc.rect(stampX, stampY, stampW, stampH);

  // Texte "PAYÉE"
  doc.setTextColor(220, 20, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PAYÉE", stampX + stampW / 2, stampY + stampH / 2 + 3, { align: "center" });
  
  doc.setTextColor(0, 0, 0);
}

/* ================= MAIN ================= */
export function downloadInvoicePdf(
  inv,
  settings,
  defaultTjm,
  isPaid = false
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  drawWatermark(doc, settings, pageW, pageH, isPaid);

  // Header robuste (dynamique)
  let y = drawHeaderLine(doc, inv, settings, pageW);

  // Bandeau métriques
  y = drawMetricsBand(doc, inv, settings, pageW, y);

  // Tableau
  y = drawMainTable(doc, inv, settings, defaultTjm, y);

  // Totaux + footer
  drawFooterSection(doc, inv, settings, defaultTjm, pageW, pageH, y);

  // Tampon "PAYÉE" en bas à droite si payée
  if (isPaid) {
    drawPaidStamp(doc, pageW, pageH);
  }

  doc.save(`${safeFilename(inv.number)}.pdf`);
}

// Anciennes fonctions (compatibilité)
export const generateInvoicePDF = (invoice, settings) => {
  return downloadInvoicePdf(invoice, settings, 0);
};

export const downloadInvoicePDF = downloadInvoicePdf;
