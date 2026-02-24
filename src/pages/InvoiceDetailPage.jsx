import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Download, CheckCircle, XCircle, Plus
} from "lucide-react";
import {
  addDaysISO,
  bcUsedDays,
  clampToRemaining,
  fmtEUR,
  invoiceHT,
  invoiceTVA,
  invoiceTTC,
  loadInvoices,
  loadSettingsLike,
  makeInvoiceNumberFromDate,
  missionEndByQuota,
  saveInvoices,
  workedDaysBetween,
} from "../lib/invoices";

// PDF (si tu as src/lib/invoicePdf.js)
import { downloadInvoicePdf } from "../lib/invoicePdf";

const SETTINGS_KEY = "fact_settings_v3";

function clampNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// garder le même délai émission->échéance
function toUTCDate(iso) {
  const [y, m, d] = (iso || "").split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
function diffDays(aISO, bISO) {
  if (!aISO || !bISO) return 60;
  const a = toUTCDate(aISO);
  const b = toUTCDate(bISO);
  const ms = b.getTime() - a.getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return Number.isFinite(days) ? days : 60;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const settings = loadSettingsLike(SETTINGS_KEY);
  const defaultTjm = Number(settings.tjmHt ?? 0) || 0;

  const quota = Number(settings.missionQuotaDays ?? 0) || 0;
  const missionStart = String(settings.missionStartDate ?? "").trim();
  const missionEnd =
    missionStart && quota > 0 ? missionEndByQuota(missionStart, quota) : "";

  const [invoices, setInvoices] = React.useState(() =>
    loadInvoices()
  );
  const [msg, setMsg] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const inv = invoices.find((x) => x.id === id);

  const showMsg = (t) => {
    setMsg(t);
    window.setTimeout(() => setMsg(""), 1700);
  };

  const updateInvoice = (patch) => {
    if (!inv) return;
    const next = invoices.map((x) =>
      x.id === inv.id ? { ...x, ...patch } : x
    );
    setInvoices(next);
    saveInvoices(next);
  };

  const updateItem = (itemId, patch) => {
    if (!inv) return;
    const items = inv.items.map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    updateInvoice({ items });
  };

  const addLine = () => {
    if (!inv) return;
    const newItem = {
      id: Math.random().toString(16).slice(2) + Date.now().toString(16),
      description: "Prestation",
      qty: 1,
      unitPrice: null,
      unit: "days",
      autoQty: false,
    };
    updateInvoice({ items: [...inv.items, newItem] });
  };

  const removeLine = (itemId) => {
    if (!inv) return;
    updateInvoice({ items: inv.items.filter((x) => x.id !== itemId) });
  };

  const markPaid = () => {
    if (!inv) return;
    const today = new Date().toISOString().split("T")[0];
    const updatedInv = {
      ...inv,
      status: "paid",
      paymentDate: inv.paymentDate || today,
    };
    updateInvoice({
      status: "paid",
      paymentDate: inv.paymentDate || today,
    });
    
    // Télécharger le PDF avec le tampon "PAYÉE"
    setTimeout(() => {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const full = raw ? JSON.parse(raw) : {};
      downloadInvoicePdf(updatedInv, full, defaultTjm, true);
    }, 100);
    
    showMsg("Marquée payée ✔ (PDF en cours de téléchargement...)");
  };

  const markIssued = () => {
    if (!inv) return;
    updateInvoice({ status: "issued", paymentDate: "" });
    showMsg("Repasse en émise ✔");
  };

  const deleteInvoice = () => {
    if (!inv) return;
    const next = invoices.filter((x) => x.id !== inv.id);
    setInvoices(next);
    saveInvoices(next);
    setShowDeleteConfirm(false);
    nav("/invoices");
  };

  if (!inv) {
    return (
      <div className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 900 }}>Facture introuvable</div>
        </div>
        <div className="cardBody">
          <button
            className="btn"
            onClick={() => nav("/invoices")}
            type="button"
          >
            <ArrowLeft size={16} style={{ marginRight: 4 }} />
            Retour liste
          </button>
        </div>
      </div>
    );
  }

  // ===== Quota BC (progression) =====
  const purchaseOrder = String(inv.purchaseOrder || "").trim();
  const usedAll = bcUsedDays(invoices, purchaseOrder);

  // jours de cette facture (somme lignes)
  const thisQty = inv.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  // consommé sans compter cette facture (utile quand on modifie)
  const usedWithoutThis = usedAll - thisQty;
  const remainingBeforeThis =
    quota > 0 ? Math.max(0, quota - Math.max(0, usedWithoutThis)) : NaN;

  const usedAfterThis =
    quota > 0
      ? Math.min(quota, Math.max(0, usedWithoutThis) + Math.max(0, thisQty))
      : NaN;
  const remainingAfterThis =
    quota > 0 ? Math.max(0, quota - usedAfterThis) : NaN;

  const progressPct =
    quota > 0 ? Math.max(0, Math.min(100, (usedAfterThis / quota) * 100)) : 0;

  // recalcul auto (jours ouvrés - congés) + clamp quota
  const recomputeAutoQty = (periodStart, periodEnd) => {
    const raw = workedDaysBetween(periodStart, periodEnd, true);
    if (quota > 0 && Number.isFinite(remainingBeforeThis)) {
      return clampToRemaining(raw, remainingBeforeThis);
    }
    return raw;
  };

  const ht = invoiceHT(inv, defaultTjm);
  const tva = invoiceTVA(inv, defaultTjm);
  const ttc = invoiceTTC(inv, defaultTjm);

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="row">
          <div>
            <div style={{ fontWeight: 900 }}>
              {inv.number}{" "}
              <span className="badge">
                {inv.status === "paid" ? "Payée" : "Émise"}
              </span>
            </div>
            <div className="hint">
              Période facturée : {inv.periodStart} → {inv.periodEnd} • Qté auto
              = jours ouvrés - congés
            </div>
          </div>

          <div className="actions">
            {msg ? <span className="toast">{msg}</span> : null}

            <button
              className="btn"
              onClick={() => nav("/invoices")}
              type="button"
              title="Retour à la liste"
            >
              <ArrowLeft size={16} />
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => {
                const raw = localStorage.getItem(SETTINGS_KEY);
                const full = raw ? JSON.parse(raw) : {};
                downloadInvoicePdf(inv, full, defaultTjm);
              }}
              title="Télécharger en PDF"
            >
              <Download size={16} />
            </button>

            {inv.status === "paid" ? (
              <button className="btn" onClick={markIssued} type="button" title="Marquer comme émise">
                <XCircle size={16} />
              </button>
            ) : (
              <button className="btnPrimary" onClick={markPaid} type="button" title="Marquer comme payée">
                <CheckCircle size={16} />
              </button>
            )}

            <button className="btn" onClick={() => setShowDeleteConfirm(true)} type="button" title="Supprimer la facture">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="cardBody">
        {/* ========================= Période mission (AUTO) ========================= */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Période de mission (automatique)</div>
              <div className="panelDesc">
                Début = Paramètres • Fin = Quota jours ouvrés (week-ends +
                congés exclus)
              </div>
            </div>
          </div>

          <div className="panelBody">
            <div
              className="settingsGrid"
              style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
            >
              <div className="previewBox">
                <div className="label">Début mission</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>
                  {missionStart || "—"}
                </div>
              </div>

              <div className="previewBox">
                <div className="label">Quota</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>
                  {quota ? `${quota} jours` : "—"}
                </div>
              </div>

              <div className="previewBox">
                <div className="label">Fin mission (calculée)</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>
                  {missionEnd || "—"}
                </div>
              </div>
            </div>

            <div className="hint" style={{ marginTop: 10 }}>
              Ajoute des congés → la fin de mission reculera automatiquement.
            </div>
          </div>
        </div>

        {/* ========================= Progression quota BC (PRO) ========================= */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Progression quota (BC)</div>
              <div className="panelDesc">
                BC : {purchaseOrder || "—"} • Quota :{" "}
                {quota ? `${quota} jours` : "—"}
              </div>
            </div>
          </div>

          <div className="panelBody">
            {quota > 0 ? (
              <>
                <div
                  style={{
                    width: "100%",
                    height: 12,
                    borderRadius: 999,
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: "var(--accent)",
                    }}
                  />
                </div>

                <div
                  className="settingsGrid"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}
                >
                  <div className="previewBox">
                    <div className="label">Consommé (hors facture)</div>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}
                    >
                      {Math.max(0, usedWithoutThis)} j
                    </div>
                  </div>

                  <div className="previewBox">
                    <div className="label">Reste avant facture</div>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}
                    >
                      {remainingBeforeThis} j
                    </div>
                  </div>

                  <div className="previewBox">
                    <div className="label">Cette facture</div>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}
                    >
                      {thisQty} j
                    </div>
                  </div>

                  <div className="previewBox">
                    <div className="label">Reste après facture</div>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}
                    >
                      {remainingAfterThis} j
                    </div>
                  </div>
                </div>

                <div className="hint" style={{ marginTop: 10 }}>
                  La quantité auto est plafonnée au "reste avant facture".
                </div>
              </>
            ) : (
              <div className="hint">
                Renseigne "Quota jours" + "BC" dans Paramètres pour activer la
                progression.
              </div>
            )}
          </div>
        </div>

        {/* ========================= Période facturée (editable) ========================= */}
        <div className="settingsGrid">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Période facturée & dates</div>
                <div className="panelDesc">
                  Qté auto recalculée sur la période (congés déduits).
                </div>
              </div>
            </div>

            <div className="panelBody">
              <div
                className="settingsGrid"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
              >
                <div className="field">
                  <div className="label">Début de période (facturé)</div>
                  <input
                    className="input"
                    type="date"
                    value={inv.periodStart}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const newEnd = inv.periodEnd || inv.issueDate;

                      const newQty = recomputeAutoQty(newStart, newEnd);
                      const items = inv.items.map((it) =>
                        it.autoQty ? { ...it, qty: newQty } : it
                      );

                      updateInvoice({ periodStart: newStart, items });
                      showMsg("Période mise à jour ✔");
                    }}
                  />
                </div>

                <div className="field">
                  <div className="label">Fin de période (facturé)</div>
                  <input
                    className="input"
                    type="date"
                    value={inv.periodEnd}
                    readOnly
                  />
                  <div className="hint">Par défaut = date d'émission</div>
                </div>
              </div>

              <div
                className="settingsGrid"
                style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
              >
                <div className="field">
                  <div className="label">Date d'émission</div>
                  <input
                    className="input"
                    type="date"
                    value={inv.issueDate}
                    onChange={(e) => {
                      const newIssue = e.target.value;

                      const delay = diffDays(inv.issueDate, inv.dueDate) || 60;
                      const periodEnd = newIssue;

                      const newQty = recomputeAutoQty(
                        inv.periodStart,
                        periodEnd
                      );
                      const items = inv.items.map((it) =>
                        it.autoQty ? { ...it, qty: newQty } : it
                      );

                      // Recalculer le numéro de facture selon la nouvelle date
                      const newNumber = makeInvoiceNumberFromDate(inv.purchaseOrder, newIssue);

                      updateInvoice({
                        number: newNumber,
                        issueDate: newIssue,
                        periodEnd,
                        dueDate: newIssue
                          ? addDaysISO(newIssue, delay)
                          : inv.dueDate,
                        items,
                      });

                      showMsg("N° facture, émission & quantités mises à jour ✔");
                    }}
                  />
                </div>

                <div className="field">
                  <div className="label">Date d'échéance</div>
                  <input
                    className="input"
                    type="date"
                    value={inv.dueDate}
                    onChange={(e) => updateInvoice({ dueDate: e.target.value })}
                  />
                </div>

                <div className="field">
                  <div className="label">Date de paiement {inv.status === "paid" ? "✔" : ""}</div>
                  <input
                    className="input"
                    type="date"
                    value={inv.paymentDate || ""}
                    onChange={(e) => updateInvoice({ paymentDate: e.target.value })}
                    disabled={inv.status !== "paid"}
                  />
                  <div className="hint">Editable seulement si payée</div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================= Client ========================= */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Client</div>
                <div className="panelDesc">Infos facturation</div>
              </div>
            </div>

            <div className="panelBody">
              <div className="field">
                <div className="label">Nom</div>
                <input
                  className="input"
                  value={inv.clientName}
                  onChange={(e) =>
                    updateInvoice({ clientName: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <div className="label">Adresse</div>
                <input
                  className="input"
                  value={inv.clientAddress}
                  onChange={(e) =>
                    updateInvoice({ clientAddress: e.target.value })
                  }
                />
              </div>

              <div
                className="settingsGrid"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
              >
                <div className="field">
                  <div className="label">Email</div>
                  <input
                    className="input"
                    value={inv.clientEmail}
                    onChange={(e) =>
                      updateInvoice({ clientEmail: e.target.value })
                    }
                  />
                </div>

                <div className="field">
                  <div className="label">Téléphone</div>
                  <input
                    className="input"
                    value={inv.clientPhone}
                    onChange={(e) =>
                      updateInvoice({ clientPhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">Bon de commande (BC)</div>
                <input
                  className="input"
                  value={inv.purchaseOrder}
                  onChange={(e) =>
                    updateInvoice({ purchaseOrder: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <div className="label">N° de facture</div>
                <input
                  className="input"
                  value={inv.number}
                  onChange={(e) =>
                    updateInvoice({ number: e.target.value })
                  }
                />
                <div className="hint">Format auto: FYYYY-MM-XXXXXX (se met à jour si vous changez la date d'émission)</div>
              </div>
            </div>
          </section>
        </div>

        {/* ========================= Lignes ========================= */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Lignes</div>
              <div className="panelDesc">
                Auto = jours ouvrés sur période − congés (plafonné au quota
                restant)
              </div>
            </div>
            <button className="btnPrimary" onClick={addLine} type="button">
              <Plus size={16} style={{ marginRight: 4 }} />
              Ajouter ligne
            </button>
          </div>

          <div className="panelBody">
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ width: 120 }}>Qté (jours)</th>
                    <th style={{ width: 160 }}>PU HT (€)</th>
                    <th style={{ width: 120 }}>Auto</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <input
                          className="input"
                          value={it.description}
                          onChange={(e) =>
                            updateItem(it.id, { description: e.target.value })
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          value={it.qty}
                          onChange={(e) =>
                            updateItem(it.id, {
                              qty: clampNumber(e.target.value, 0),
                              autoQty: false,
                            })
                          }
                          step="1"
                          min="0"
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          value={it.unitPrice ?? ""}
                          onChange={(e) =>
                            updateItem(it.id, {
                              unitPrice:
                                e.target.value === ""
                                  ? null
                                  : clampNumber(e.target.value, 0),
                            })
                          }
                          placeholder={`TJM (${defaultTjm || 0})`}
                          step="10"
                          min="0"
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={!!it.autoQty}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              const q = recomputeAutoQty(
                                inv.periodStart,
                                inv.periodEnd
                              );
                              updateItem(it.id, { autoQty: true, qty: q });
                              showMsg("Auto activé ✔");
                            } else {
                              updateItem(it.id, { autoQty: false });
                              showMsg("Auto désactivé ✔");
                            }
                          }}
                        />
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn"
                          onClick={() => removeLine(it.id)}
                          type="button"
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inv.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Aucune ligne. Clique sur "Ajouter ligne".
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="settingsGrid" style={{ marginTop: 12 }}>
              <div className="field">
                <div className="label">Notes</div>
                <input
                  className="input"
                  value={inv.notes}
                  onChange={(e) => updateInvoice({ notes: e.target.value })}
                />
              </div>

              <div className="previewBox">
                <div className="label">Récapitulatif</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <div className="row">
                    <span className="muted">Total HT</span>
                    <strong>{fmtEUR(ht)}</strong>
                  </div>
                  <div className="row">
                    <span className="muted">TVA</span>
                    <strong>{fmtEUR(tva)}</strong>
                  </div>
                  <div className="divider" />
                  <div className="row">
                    <span>Total TTC</span>
                    <strong style={{ fontSize: 18 }}>{fmtEUR(ttc)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="hint" style={{ marginTop: 12 }}>
              ✅ Auto = jours ouvrés sur période − congés. Quota BC : l'auto est
              plafonné au reste.
            </div>
          </div>
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
          onClick={() => setShowDeleteConfirm(false)}
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
              Êtes-vous sûr de vouloir supprimer la facture {inv?.number} ? Cette action ne peut pas être annulée.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                Annuler
              </button>
              <button
                className="btnPrimary"
                onClick={() => deleteInvoice()}
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
