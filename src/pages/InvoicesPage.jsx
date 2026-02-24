import React from "react";
import { Plus, CheckCircle, XCircle, FileText, Trash2, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  addDaysISO,
  bcUsedDays,
  clampToRemaining,
  endOfMonthISO,
  fmtEUR,
  invoiceHT,
  invoiceTTC,
  invoiceTVA,
  loadInvoices,
  loadSettingsLike,
  nextWeekdayISO,
  saveInvoices,
  workedDaysBetween,
  isoToday,
  makeInvoiceNumberFromDate,
} from "../lib/invoices";
import { downloadInvoicePdf } from "../lib/invoicePdf";

const SETTINGS_KEY = "fact_settings_v3";

export default function InvoicesPage() {
  const nav = useNavigate();
  const [invoices, setInvoices] = React.useState(() =>
    loadInvoices()
  );
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(null);

  const settings = loadSettingsLike(SETTINGS_KEY);
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0;

  // Filtrer les factures selon la recherche
  const filteredInvoices = invoices.filter((i) => {
    const term = searchTerm.toLowerCase();
    return (
      (i.number || "").toLowerCase().includes(term) ||
      (i.clientName || "").toLowerCase().includes(term) ||
      (i.issueDate || "").includes(term) ||
      (i.purchaseOrder || "").toLowerCase().includes(term)
    );
  });

  // Trier par date décroissante (récent d'abord)
  const sortedInvoices = [...filteredInvoices].sort((a, b) =>
    (b.issueDate || "").localeCompare(a.issueDate || "")
  );

  const totalHT = sortedInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + invoiceHT(i, defaultTjm), 0);

  const totalTTC = sortedInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + invoiceTTC(i, defaultTjm), 0);

  const downloadPdfForInvoice = (inv) => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const settingsData = raw ? JSON.parse(raw) : {};
      const tjm = Number(settingsData.tjmHt ?? 0) || 0;
      const isPaid = inv.status === "paid";
      downloadInvoicePdf(inv, settingsData, tjm, isPaid);
    } catch (err) {
      console.error("Erreur lors du téléchargement PDF:", err);
    }
  };

  const markPaid = (id) => {
    const today = new Date().toISOString().split("T")[0];
    const updatedInvoices = invoices.map((i) =>
      i.id === id
        ? {
            ...i,
            status: "paid",
            paymentDate: i.paymentDate || today,
          }
        : i
    );
    
    const updatedInvoice = updatedInvoices.find(i => i.id === id);
    
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
    
    // Télécharger immédiatement le PDF avec le tampon "PAYÉE"
    if (updatedInvoice) {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const settingsData = raw ? JSON.parse(raw) : {};
        const tjm = Number(settingsData.tjmHt ?? 0) || 0;
        downloadInvoicePdf(updatedInvoice, settingsData, tjm, true);
      } catch (err) {
        console.error("Erreur lors du téléchargement PDF:", err);
      }
    }
  };

  const markIssued = (id) => {
    const next = invoices.map((i) =>
      i.id === id ? { ...i, status: "issued", paymentDate: "" } : i
    );
    setInvoices(next);
    saveInvoices(next);
  };

  const deleteInvoice = (id) => {
    const next = invoices.filter((i) => i.id !== id);
    setInvoices(next);
    saveInvoices(next);
    setShowDeleteConfirm(null);
  };

  const createInvoice = () => {
    // date d'émission = fin du mois courant
    const issueDate = endOfMonthISO(isoToday());

    // BC depuis paramètres
    const purchaseOrder = String(settings.purchaseOrder ?? "").trim();

    // numéro: FYYYY-MM-XXXXXX (6 derniers chiffres du BC)
    const number = makeInvoiceNumberFromDate(purchaseOrder, issueDate);

    const delayDays = Number(settings.paymentDelayDays ?? 60) || 60;

    const missionStart = String(settings.missionStartDate ?? "").trim();
    const quota = Number(settings.missionQuotaDays ?? 0) || 0;

    const lastSameBC = [...invoices]
      .filter((i) => String(i.purchaseOrder || "").trim() === purchaseOrder)
      .sort((a, b) => (a.issueDate > b.issueDate ? -1 : 1))[0];

    const periodStart = lastSameBC
      ? nextWeekdayISO(lastSameBC.periodEnd || lastSameBC.issueDate)
      : missionStart || issueDate;

    const periodEnd = issueDate;

    const rawQty = workedDaysBetween(periodStart, periodEnd, true);

    const used = bcUsedDays(invoices, purchaseOrder);
    const remaining = quota > 0 ? Math.max(0, quota - used) : NaN;
    const qty = Number.isFinite(remaining)
      ? clampToRemaining(rawQty, remaining)
      : rawQty;

    const inv = {
      id: Math.random().toString(16).slice(2) + Date.now().toString(16),

      number,

      periodStart,
      periodEnd,

      issueDate,
      dueDate: addDaysISO(issueDate, delayDays),
      status: "issued",
      paymentDate: "",

      clientName: String(settings.clientName ?? ""),
      clientAddress: String(settings.clientAddress ?? ""),
      clientEmail: String(settings.clientEmail ?? ""),
      clientPhone: String(settings.clientPhone ?? ""),
      purchaseOrder,

      vatEnabled: true,
      vatRate: 20,

      items: [
        {
          id: "l1",
          description: "Prestation",
          qty,
          unitPrice: null,
          unit: "days",
          autoQty: true,
        },
      ],
      notes: "",
    };

    const next = [inv, ...invoices];
    setInvoices(next);
    saveInvoices(next);
    nav(`/invoices/${inv.id}`);
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="row">
          <div>
            <div style={{ fontWeight: 900 }}>Factures</div>
            <div className="hint">
              Bouton "Payée" dispo directement dans la liste.
            </div>
          </div>

          <div className="actions">
            <button
              className="btnPrimary"
              onClick={createInvoice}
              type="button"
            >
              <Plus size={18} style={{ marginRight: 4 }} />
              Créer une facture
            </button>
          </div>
        </div>
      </div>

      <div className="cardBody">
        <div className="kpiRow" style={{ marginBottom: 14 }}>
          <div className="kpi">
            <div className="label">Factures</div>
            <div className="kpiVal">{sortedInvoices.length}</div>
          </div>

          <div className="kpi">
            <div className="label">Encaissements HT</div>
            <div className="kpiVal">{fmtEUR(totalHT)}</div>
          </div>

          <div className="kpi">
            <div className="label">Encaissements TTC</div>
            <div className="kpiVal">{fmtEUR(totalTTC)}</div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            type="text"
            placeholder="🔍 Chercher par N°, client, date ou BC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Émission</th>
                <th>Période</th>
                <th>BC</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>TVA</th>
                <th>Montant TTC</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    {searchTerm ? "Aucune facture trouvée." : "Aucune facture. Clique sur \"Créer une facture\"."}
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 800 }}>{inv.number}</td>
                    <td className="muted">{inv.issueDate}</td>
                    <td className="muted">
                      {inv.periodStart} → {inv.periodEnd}
                    </td>
                    <td className="muted">{inv.purchaseOrder || "—"}</td>
                    <td>
                      <span className="badge">
                        {inv.status === "paid" ? "Payée" : "Émise"}
                      </span>
                    </td>
                    <td className="muted">{inv.paymentDate || "—"}</td>
                    <td style={{ fontWeight: 800 }}>
                      {fmtEUR(invoiceTVA(inv, defaultTjm))}
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {fmtEUR(invoiceTTC(inv, defaultTjm))}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn"
                        onClick={() => nav(`/invoices/${inv.id}`)}
                        type="button"
                        title="Ouvrir la facture"
                      >
                        <FileText size={16} />
                      </button>{" "}
                      <button
                        className={`btn ${inv.status === "paid" ? "btnPrimary" : ""}`}
                        onClick={() => downloadPdfForInvoice(inv)}
                        type="button"
                        title={inv.status === "paid" ? "Télécharger PDF payé" : "Télécharger PDF"}
                      >
                        <Download size={16} />
                      </button>{" "}
                      {inv.status === "paid" ? (
                        <button
                          className="btn"
                          onClick={() => markIssued(inv.id)}
                          type="button"
                          title="Annuler le paiement"
                        >
                          <XCircle size={16} />
                        </button>
                      ) : (
                        <button
                          className="btnPrimary"
                          onClick={() => markPaid(inv.id)}
                          type="button"
                          title="Marquer comme payée"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}{" "}
                      <button
                        className="btn"
                        onClick={() => setShowDeleteConfirm(inv.id)}
                        type="button"
                        title="Supprimer la facture"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
              ⚠️ Confirmer la suppression
            </div>
            <div style={{ marginBottom: 16, fontSize: 14 }}>
              Êtes-vous sûr de vouloir supprimer cette facture ? Cette action ne peut pas être annulée.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setShowDeleteConfirm(null)}
                type="button"
              >
                Annuler
              </button>
              <button
                className="btnPrimary"
                onClick={() => deleteInvoice(showDeleteConfirm)}
                type="button"
                style={{ background: "#dc3545" }}
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

