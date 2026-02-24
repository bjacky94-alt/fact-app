import React from "react";
import { Plus, Trash2, Eye, FileText, Upload } from "lucide-react";
import SelectCustom from "../components/SelectCustom";
import {
  fileToDataUrl,
  fmtEUR,
  loadExpenses,
  monthOfISO,
  newId,
  saveExpenses,
  sumExpenses,
  yearOfISO,
} from "../lib/expenses";

const CATEGORIES = [
  "Essence",
  "Téléphone",
  "Fourniture",
  "Autre",
];

const EXPENSE_VAT_RATE = 20;

function vatFromTTC(ttc, rate = EXPENSE_VAT_RATE) {
  const amountTtc = Number(ttc) || 0;
  const vatRate = Number(rate) || 0;
  if (amountTtc <= 0 || vatRate <= 0) return 0;
  return amountTtc - amountTtc / (1 + vatRate / 100);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ExpensesPage() {
  const [items, setItems] = React.useState(() => loadExpenses());

  // filtres
  const years = React.useMemo(() => {
    const ys = Array.from(new Set(items.map((e) => yearOfISO(e.date)))).sort(
      (a, b) => b - a
    );
    const cur = new Date().getFullYear();
    if (!ys.includes(cur)) ys.unshift(cur);
    return ys;
  }, [items]);

  const [year, setYear] = React.useState(() =>
    new Date().getFullYear()
  );


  // form
  const [date, setDate] = React.useState(todayISO());
  const [category, setCategory] = React.useState("Essence");
  const [vendor, setVendor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  const [receiptName, setReceiptName] = React.useState("");
  const [receiptDataUrl, setReceiptDataUrl] = React.useState("");

  const filtered = React.useMemo(() => {
    return items
      .filter((e) => yearOfISO(e.date) === year)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [items, year]);

  const totalYear = sumExpenses(filtered);

  const onAdd = () => {
    const amt = Number(String(amount).replace(",", "."));
    if (!date || !Number.isFinite(amt) || amt <= 0) return;

    const e = {
      id: newId(),
      date,
      category,
      vendor: vendor.trim(),
      description: description.trim(),
      amount: amt,
      receiptName: receiptName || undefined,
      receiptDataUrl: receiptDataUrl || undefined,
    };

    const next = [e, ...items];
    setItems(next);
    saveExpenses(next);

    // reset
    setVendor("");
    setDescription("");
    setAmount("");
    setReceiptName("");
    setReceiptDataUrl("");
  };

  const onDelete = (id) => {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    saveExpenses(next);
  };

  const onReceiptChange = async (file) => {
    if (!file) {
      setReceiptName("");
      setReceiptDataUrl("");
      return;
    }
    // éviter gros fichiers en localStorage
    if (file.size > 2_000_000) {
      alert("Fichier trop gros (max 2 Mo).");
      return;
    }
    const r = await fileToDataUrl(file);
    setReceiptName(r.name);
    setReceiptDataUrl(r.dataUrl);
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="row">
          <div>
            <div style={{ fontWeight: 900 }}>Dépenses</div>
            <div className="hint">
              Ajoute tes frais (transport, repas, logiciel…) et filtre par
              année/mois.
            </div>
          </div>
        </div>
      </div>

      <div className="cardBody">
        {/* Filtres */}
        <div
          className="row"
          style={{ gap: 10, marginBottom: 14, alignItems: "end" }}
        >
          <div style={{ minWidth: 140 }}>
            <div className="label">Année</div>
            <SelectCustom
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectCustom>
          </div>

          <div style={{ flex: 1 }} />

          <div className="kpi" style={{ minWidth: 220 }}>
            <div className="label">Total année</div>
            <div className="kpiVal">{fmtEUR(totalYear)}</div>
          </div>
        </div>

        {/* Form ajout */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="cardBody">
            <div className="grid2">
              <div>
                <div className="label">Date</div>
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div style={{ maxWidth: 140 }}>
                <div className="label">Catégorie</div>
                <SelectCustom
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value)
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectCustom>
              </div>

              <div>
                <div className="label">Fournisseur (optionnel)</div>
                <input
                  className="input"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="SNCF, Uber, Adobe..."
                />
              </div>

              <div>
                <div className="label">Montant TTC</div>
                <input
                  className="input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="ex: 12,50"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div className="label">Description</div>
                <input
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ex: billet train, repas client..."
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div className="label">Justificatif (optionnel, max 2 Mo)</div>
                <input
                  className="input"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => onReceiptChange(e.target.files?.[0])}
                />
                {receiptName ? (
                  <div className="hint" style={{ marginTop: 6 }}>
                    <FileText size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    Fichier: {receiptName}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btnPrimary" type="button" onClick={onAdd}>
                <Plus size={18} style={{ marginRight: 4 }} />
                Ajouter la dépense
              </button>
            </div>
          </div>
        </div>

        {/* Liste */}
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Description</th>
                <th>Fournisseur</th>
                <th>Justificatif</th>
                <th style={{ textAlign: "right" }}>TVA ({EXPENSE_VAT_RATE}%)</th>
                <th style={{ textAlign: "right" }}>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Aucune dépense sur ce mois.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="muted">{e.date}</td>
                    <td>
                      <span className="badge">{e.category}</span>
                    </td>
                    <td>{e.description || <span className="muted">—</span>}</td>
                    <td className="muted">{e.vendor || "—"}</td>
                    <td>
                      {e.receiptDataUrl ? (
                        <a
                          href={e.receiptDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <Eye size={14} />
                          Voir
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {fmtEUR(vatFromTTC(e.amount))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>
                      {fmtEUR(e.amount)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => onDelete(e.id)}
                        title="Supprimer"
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
    </div>
  );
}
