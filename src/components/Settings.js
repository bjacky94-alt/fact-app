import { AlertTriangle, ImagePlus, Save } from "lucide-react";
import { useEffect, useState } from "react";

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, critical = false }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-200">
        <span>{label}</span>
        {critical && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            <AlertTriangle size={12} /> Critique
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-2 ${
          critical
            ? "border-amber-500/70 focus:border-amber-400 focus:ring-amber-500/30"
            : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/25"
        }`}
      />
    </label>
  );
}

export default function Settings({ data, onSave }) {
  const [formData, setFormData] = useState(data);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setFormData(data);
  }, [data]);

  const updateField = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = async (field, file) => {
    if (!file) {
      return;
    }

    const base64 = await readFileAsBase64(file);
    updateField("appConfig", field, base64);
  };

  const handleSave = () => {
    onSave(formData);
    setSavedAt(new Date().toLocaleTimeString("fr-FR"));
  };

  return (
    <div className="relative pb-24">
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Mon Entreprise" subtitle="Informations légales et coordonnées de votre activité.">
          <Input
            label="Nom"
            value={formData.userProfile.name}
            onChange={(event) => updateField("userProfile", "name", event.target.value)}
          />
          <Input
            label="Adresse"
            value={formData.userProfile.address}
            onChange={(event) => updateField("userProfile", "address", event.target.value)}
          />
          <Input
            label="Téléphone"
            value={formData.userProfile.phone}
            onChange={(event) => updateField("userProfile", "phone", event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={formData.userProfile.email}
            onChange={(event) => updateField("userProfile", "email", event.target.value)}
          />
          <Input
            label="SIRET"
            value={formData.userProfile.siret}
            onChange={(event) => updateField("userProfile", "siret", event.target.value)}
          />
          <Input
            label="TVA Intracom"
            value={formData.userProfile.tvaIntra}
            onChange={(event) => updateField("userProfile", "tvaIntra", event.target.value)}
          />
        </SectionCard>

        <SectionCard title="Mission / Client" subtitle="Paramètres de mission et informations client par défaut.">
          <Input
            label="Nom du client"
            value={formData.clientConfig.name}
            onChange={(event) => updateField("clientConfig", "name", event.target.value)}
          />
          <Input
            label="Adresse client"
            value={formData.clientConfig.address}
            onChange={(event) => updateField("clientConfig", "address", event.target.value)}
          />
          <Input
            label="Email client"
            type="email"
            value={formData.clientConfig.email}
            onChange={(event) => updateField("clientConfig", "email", event.target.value)}
          />
          <Input
            label="Téléphone client"
            value={formData.clientConfig.phone}
            onChange={(event) => updateField("clientConfig", "phone", event.target.value)}
          />
          <Input
            label="TJM par défaut (€)"
            type="number"
            critical
            value={formData.clientConfig.defaultTjm}
            onChange={(event) =>
              updateField("clientConfig", "defaultTjm", parseNumber(event.target.value))
            }
          />
          <Input
            label="Quota de jours vendus"
            type="number"
            value={formData.clientConfig.quotaJours}
            onChange={(event) =>
              updateField("clientConfig", "quotaJours", parseNumber(event.target.value))
            }
          />
          <Input
            label="Bon de Commande"
            critical
            value={formData.clientConfig.bonCommande}
            onChange={(event) => updateField("clientConfig", "bonCommande", event.target.value)}
          />
          <Input
            label="Délai de paiement (jours)"
            type="number"
            value={formData.clientConfig.paymentDelay}
            onChange={(event) =>
              updateField("clientConfig", "paymentDelay", parseNumber(event.target.value))
            }
          />
        </SectionCard>

        <SectionCard
          title="Banque & Visuel"
          subtitle="Coordonnées bancaires et éléments graphiques (logo/signature)."
        >
          <Input
            label="Nom de la banque"
            value={formData.bankDetails.bankName}
            onChange={(event) => updateField("bankDetails", "bankName", event.target.value)}
          />
          <Input
            label="IBAN"
            value={formData.bankDetails.iban}
            onChange={(event) => updateField("bankDetails", "iban", event.target.value)}
          />
          <Input
            label="BIC"
            value={formData.bankDetails.bic}
            onChange={(event) => updateField("bankDetails", "bic", event.target.value)}
          />

          <label className="block rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-4">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
              <ImagePlus size={16} /> Logo (Base64)
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleFileUpload("logoUrl", event.target.files?.[0])}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
            />
          </label>

          <label className="block rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-4">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
              <ImagePlus size={16} /> Signature (Base64)
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleFileUpload("signatureUrl", event.target.files?.[0])}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
            />
          </label>

          <Input
            label="Prochain numéro de facture"
            type="number"
            value={formData.appConfig.nextInvoiceNumber}
            onChange={(event) =>
              updateField("appConfig", "nextInvoiceNumber", parseNumber(event.target.value))
            }
          />
        </SectionCard>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-900/50 transition hover:bg-blue-500"
      >
        <Save size={18} /> Sauvegarder
      </button>

      {savedAt && (
        <p className="mt-4 text-sm text-emerald-400">Dernière sauvegarde : {savedAt}</p>
      )}
    </div>
  );
}
